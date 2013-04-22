/**
 * s3.js - S3 Uploading
 *
 * Copyright (c) 2012 DIY Co
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this
 * file except in compliance with the License. You may obtain a copy of the License at:
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
 * ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 *
 * @author Brian Reavis <brian@thirdroute.com>
 */

var _         = require('underscore');
var fs        = require('fs');
var path      = require('path');
var crypto    = require('crypto');
var knox      = require('knox');
var minimatch = require('minimatch');
var mime      = require('mime');
var async     = require('async');

module.exports = function(roto) {

	roto.defineTask('s3', function(callback, options, target, globalOptions) {

		_.defaults(options, {
			acl          : 'public-read',
			method       : 'sync',
			force        : false,
			folder       : null,
			files        : null,
			ignore       : [],
			headers      : {},
			bucket       : null,
			destination  : '/',
			concurrency  : 3,
			ttl          : 2678400,
			gzip         : false,
			secure       : false,
			manifest     : '.manifest.json',
			file_headers : []
		});

		_.defaults(options.headers, {
			'Cache-Control': 'public,max-age=' + options.ttl,
			'x-amz-acl': options.acl
		});

		if (!options.files && !options.folder) {
			console.error(roto.colorize('ERROR:', 'red') + ' No folder / files specified.');
			return callback(false);
		}

		var folder         = options.folder || '/';
		var folder_remote  = options.destination || '/';
		var manifest       = {};
		var delta          = [];
		var bytes_queued   = 0;
		var bytes_uploaded = 0;
		var zlib           = options.gzip ? require('zlib') : null;
		var files          = null;
		var headers        = options.headers || {};
		var headers_files  = {};
		var trimslashes    = function(str) { return str.replace(/^[\/\\]+|[\/\\]+$/g, ''); };

		if (folder.charAt(folder.length - 1) !== '/') {
			folder = folder + '/';
		}

		if (folder_remote.charAt(folder_remote.length - 1) !== '/') {
			folder_remote = folder_remote + '/';
		}

		if (options.file_headers) {
			for (var pattern in options.file_headers) {
				if (!options.file_headers.hasOwnProperty(pattern)) continue;
				if (options.file_headers[pattern].hasOwnProperty('acl')) {
					options.file_headers[pattern]['x-amz-acl'] = options.file_headers[pattern]['acl'];
					delete options.file_headers[pattern]['acl'];
				}
				if (options.file_headers[pattern].hasOwnProperty('ttl')) {
					options.file_headers[pattern]['Cache-Control'] = 'public,max-age=' + options.file_headers[pattern]['ttl'];
					delete options.file_headers[pattern]['ttl'];
				}
			}
		}

		var client = knox.createClient({
			key: options.key,
			secret: options.secret,
			bucket: options.bucket,
			secure: options.secure
		});

		console.log(roto.colorize(options.bucket, 'white') + '/' + folder_remote.replace(/^\//, '') + ' (S3)');

		async.series([

			// read remote manifest
			function(callback) {
				if (options.force) return callback();
				process.stdout.write('Fetching remote manifest... ');

				client.getFile(folder_remote + options.manifest, function(err, res) {
					if (err) {
						process.stdout.write('\n');
						callback(err);
					} else if (res.statusCode === 200) {
						var buffer = new Buffer(parseInt(res.headers['content-length']));
						var bufferPos = 0;
						res.on('data', function(data) {
							data.copy(buffer, bufferPos);
							bufferPos += data.length;
						});
						res.on('error', function(err) {
							process.stdout.write('\n');
							callback(err);
						});
						res.on('end', function() {
							manifest = JSON.parse(buffer.toString('utf8')) || {};
							console.log('[' + roto.colorize('success', 'green') + ']');
							callback();
						});
					} else {
						console.log(' (empty) [' + roto.colorize('success', 'green') + ']');
						callback();
					}
				});
			},

			// read files list
			function(callback) {
				var i, n, patterns_ignore, patterns_files;

				patterns_ignore = [];
				patterns_files = [];

				for (i = 0, n = options.ignore.length; i < n; i++) {
					patterns_ignore.push(folder + options.ignore[i]);
				}

				if (options.files) {
					process.stdout.write('Enumerating files... ');
					for (i = 0, n = options.files.length; i < n; i++) {
						patterns_files.push(folder + options.files[i]);
					}
					files = roto.findFiles(patterns_files, patterns_ignore);
					console.log('[' + roto.colorize('success', 'green') + ']');
				} else {
					files = [];
					process.stdout.write('Enumerating directory tree... ');
					files = roto.findFiles(folder + '**', patterns_ignore);
					console.log('[' + roto.colorize('success', 'green') + ']');
				}

				return callback();
			},

			// read individualized file headers
			function(callback) {
				if (!options.file_headers) return callback();
				for (var i = 0, n = files.length; i < n; i++) {
					for (var pattern in options.file_headers) {
						if (!options.file_headers.hasOwnProperty(pattern)) continue;
						if (minimatch(files[i], folder + pattern)) {
							headers_files[files[i]] = options.file_headers[pattern];
						}
					}
				}
				callback();
			},

			// calculate delta
			function(callback) {
				process.stdout.write('Calculating delta... ');

				_.each(files, function(path_local) {
					var stats = fs.statSync(path_local);

					if (stats.isFile()) {
						// calculate checksum
						var md5 = crypto.createHash('md5');
						md5.update(fs.readFileSync(path_local, 'utf8'));
						var hash = md5.digest('hex');

						// ignore files that already exist byte-for-byte on S3
						if (manifest.hasOwnProperty(path_local)) {
							if (hash === manifest[path_local]) {
								return;
							}
						}

						// queue for upload
						bytes_queued += stats.size;

						var filename      = path.basename(path_local);
						var extension     = path.extname(path_local);
						var path_local_gz = path_local.substring(0, path_local.length - extension.length) + '.gz' + extension;

						delta.push({
							path_local     : path_local,
							path_remote    : path.normalize(folder_remote + trimslashes(path_local.substring(trimslashes(folder).length))),
							path_remote_gz : path.normalize(folder_remote + trimslashes(path_local_gz.substring(trimslashes(folder).length))),
							hash           : hash,
							size           : stats.size
						});
					}
				});
				console.log('[' + roto.colorize('success', 'green') + ']');
				callback();
			}

		], function(err) {
			if (err) {
				console.error(roto.colorize('ERROR: ', 'red') + err);
				return callback(false);
			}
			if (!delta.length) {
				console.log('All files up-to-date.');
				return callback();
			}

			// display delta
			console.log(delta.length.toString() + ' ' + (delta.length === 1 ? 'file' : 'files') + ' queued:');
			for (var i = 0, n = delta.length; i < n; i++) {
				console.log(roto.colorize('   + ', 'gray') + delta[i].path_local);
			}
			console.log(roto.colorize('   ' + roto.formatFilesize(bytes_queued), 'gray'));

			// file upload worker queue
			var queue_files = async.queue(function(file, callback) {

				fs.readFile(file.path_local, function(err, buffer) {
					if (err) return callback(err);

					async.parallel([

						// original file
						function(callback) {
							var req = client.put(file.path_remote, _.extend({
								'Content-Length' : buffer.length,
								'Content-Type'   : mime.lookup(file.path_local)
							}, options.headers, headers_files[file.path_local]));

							req.on('response', function(res) {
								bytes_uploaded += file.size;
								manifest[file.path_local] = file.hash;
								callback();
							});

							req.on('error', function(err) {
								callback(err);
							});

							req.end(buffer);
						},

						// gzipped file
						function(callback) {
							if (options.gzip) {
								zlib.gzip(buffer, function(err, buffer) {
									if (!err) {
										var req = client.put(file.path_remote_gz, _.extend({
											'Content-Length'   : buffer.length,
											'Content-Type'     : mime.lookup(file.path_local),
											'Content-Encoding' : 'gzip'
										}, options.headers, headers_files[file.path_local]));

										req.on('response', function(res) {
											callback();
										});

										req.end(buffer);
									} else {
										callback('Error gzipping "' + file.path_local + '"');
									}
								});
							} else {
								callback();
							}
						}
					], function(err) {
						callback(err);
					});
				});

			}, options.concurrency);

			// manifest syncing
			var manifestSyncing = false;
			var updateManifest = function(callback) {
				manifestSyncing = true;
				var buffer = new Buffer(JSON.stringify(manifest), 'utf8');
				var req = client.put(folder_remote + options.manifest, {
					'Content-Length' : buffer.length,
					'Content-Type'   : 'application/json',
					'x-amz-acl'      : 'private'
				});
				req.on('response', function(res) {
					manifestSyncing = false;
					if (typeof callback === 'function') {
						callback();
					}
				});
				req.end(buffer);
			};

			// sync manifest intermittently
			var interval_manifest = setInterval(function() {
				if (!manifestSyncing) updateManifest();
			}, 10000);

			// display upload progress
			var interval_display = setInterval(function() {
				process.stdout.write('\r' + roto.colorize(Math.round(bytes_uploaded / bytes_queued * 100).toString() + '%', 'white') + ' - ' + roto.formatFilesize(bytes_uploaded) + ' of ' + roto.formatFilesize(bytes_queued) + '              ');
			}, 1000);

			queue_files.drain = function(err) {
				clearInterval(interval_display);
				clearInterval(interval_manifest);

				console.log('\rUpload complete.              ');
				process.stdout.write('Updating remote manifest... ');

				updateManifest(function() {
					if (err) {
						console.error(err + ' [' + roto.colorize('fail', 'red') + ']');
						callback(false);
					} else {
						console.log('[' + roto.colorize('success', 'green') + ']');
						callback();
					}
				});
			};

			// begin the upload
			queue_files.push(delta);
		});

	});

};
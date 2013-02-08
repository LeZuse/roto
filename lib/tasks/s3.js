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

var _        = require('underscore'),
    fs       = require('fs'),
    path     = require('path'),
    crypto   = require('crypto'),
    knox     = require('knox'),
    mime     = require('mime'),
    async    = require('async'),
    colorize = require('../colorize.js');

module.exports = function(roto) {

	roto.defineTask('s3', function(callback, options, target, globalOptions) {

		_.defaults(options, {
			acl         : 'public-read',
			method      : 'sync',
			force       : false,
			folder      : null,
			ignore      : [],
			headers     : {},
			bucket      : null,
			destination : '/',
			concurrency : 3,
			ttl         : 2678400,
			gzip        : false,
			manifest    : '.manifest.json'
		});

		_.defaults(options.headers, {
			'Cache-Control': 'public,max-age=' + options.ttl,
			'x-amz-acl': options.acl
		});

		var folder         = options.folder;
		var folder_remote  = (options.destination || '/');
		var manifest       = {};
		var delta          = [];
		var bytes_queued   = 0;
		var bytes_uploaded = 0;
		var zlib           = options.gzip ? require('zlib') : null;

		if (folder.charAt(folder.length - 1) !== '/') {
			folder = folder + '/';
		}

		if (folder_remote.charAt(folder_remote.length - 1) !== '/') {
			folder_remote = folder_remote + '/';
		}

		var client = knox.createClient({
			key: options.key,
			secret: options.secret,
			bucket: options.bucket
		});

		roto.notice(colorize(folder, 'white') + ' -> ' + colorize(options.bucket, 'white') + '/' + folder_remote.replace(/^\//, '') + ' (S3)\n');

		async.series({

			// read remote manifest
			manifest: function(callback) {
				if (options.force) return callback();
				roto.notice('Fetching remote manifest... ');
				client.getFile(folder_remote + options.manifest, function(err, res) {
					if (res.statusCode === 200) {
						var buffer = new Buffer(parseInt(res.headers['content-length']));
						var bufferPos = 0;
						res.on('data', function(data) {
							data.copy(buffer, bufferPos);
							bufferPos += data.length;
						});
						res.on('end', function() {
							manifest = JSON.parse(buffer.toString('utf8')) || {};
							roto.notice('[' + roto.colorize('success', 'green') + ']\n');
							callback();
						});
					} else {
						roto.notice(' (empty) [' + roto.colorize('success', 'green') + ']\n');
						callback();
					}
				});
			},

			// read files list
			delta: function(callback) {
				roto.notice('Calculating delta... ');

				var ignore = [];
				for (var i = 0, n = options.ignore.length; i < n; i++) {
					ignore.push(folder + '**/' + options.ignore);
				}

				var paths = roto.findFiles(folder + '**', ignore);
				_.each(paths, function(path_local) {
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
							path_remote    : folder_remote + path_local.substring(folder.length),
							path_remote_gz : folder_remote + path_local_gz.substring(folder.length),
							hash           : hash,
							size           : stats.size
						});
					}
				});
				roto.notice('[' + roto.colorize('success', 'green') + ']\n');
				callback();
			}

		}, function() {
			if (!delta.length) {
				roto.notice('All files up-to-date.\n');
				callback();
				return;
			}

			roto.notice(delta.length.toString() + ' files queued for upload (' + (bytes_queued / 1048576).toFixed(2) + 'mb)\n');

			// file upload worker queue
			var queue_files = async.queue(function(file, callback) {

				fs.readFile(file.path_local, function(err, buffer) {
					async.parallel([

						// original file
						function(callback) {
							var req = client.put(file.path_remote, _.extend({
								'Content-Length' : buffer.length,
								'Content-Type'   : mime.lookup(file.path_local)
							}, options.headers || {}));

							req.on('response', function(res) {
								bytes_uploaded += file.size;
								manifest[file.path_local] = file.hash;
								callback();
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
										}, options.headers || {}));

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
				roto.notice('\r' + colorize(Math.round(bytes_uploaded / bytes_queued * 100).toString() + '%', 'white') + ' - ' + Math.round(bytes_uploaded / 1024) + 'kb of ' + Math.round(bytes_queued / 1024) + 'kb            ');
			}, 1000);

			queue_files.drain = function(err) {
				clearInterval(interval_display);
				clearInterval(interval_manifest);

				roto.notice('\rUpload complete.              \n');
				roto.notice('Updating remote manifest... ');

				updateManifest(function() {
					if (err) {
						roto.error(err);
						roto.notice('[' + roto.colorize('fail', 'red') + ']\n');
						callback(false);
					} else {
						roto.notice('[' + roto.colorize('success', 'green') + ']\n');
						callback();
					}
				});
			};

			// begin the upload
			queue_files.push(delta);
		});

	});

};
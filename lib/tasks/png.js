/**
 * png.js - The catch-all PNG optimizer task
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
 * @author Zachary Bruggeman <zbruggeman@me.com>
 */

var _        = require('underscore'),
    spawn    = require('child_process').spawn,
    colorize = require('../colorize'),
    async    = require('async');

module.exports = function(roto) {

	roto.defineTask('png', function(callback, options, target, globalOptions) {

		var files;
		var binary;
		var queue;
		var args;

		var binaries = {
			'optipng'  : 'optipng',
			'pngquant' : 'pngquant',
			'pngcrush' : 'pngcrush'
		};

		_.defaults(options, {
			compressor : 'none',
			args       : [],
			workers    : 1,
			binary     : null
		});

		args = options.args || [];

		// find files
		var files = roto.findFiles(options.files, options.ignore);
		if (!files.length) {
			console.log('No matching files were found.');
			return callback();
		};

		// get compressor
		if (options.compressor === 'none') {
			console.error(colorize('ERROR: ', 'red') + 'You need to specify a compressor!');
			return callback(false);
		}
		var binary = options.binary || binaries[options.compressor];

		// push and format args
		if (options.compressor === 'pngcrush') {
			args.unshift('-ow');
		} else if (options.compressor === 'optipng' || options.compressor === 'pngquant') {
			args.push('--');
		}

		// queue files
		console.log('Compressing pngs using ' + options.compressor + '...');
		var queue = async.queue(function(filename, callback) {
			console.log(colorize('   + ', 'gray') + filename);
			var proc_args = args.slice(0);
			proc_args.push(filename);
			var proc = spawn(binary, proc_args);
			proc.on('exit', function(code) { callback(); });
			proc.stderr.setEncoding('utf8');
			proc.stderr.on('data', function (data) {
				if (/^execvp\(\)/.test(data)) {
					console.error(colorize('Error: ', 'red') + ' Failed to start ' + binary);
				}
			});
		}, options.workers);

		queue.drain = function(error) {
			if (error) callback(false);
			else callback();
		};

		queue.push(files);

	});
};
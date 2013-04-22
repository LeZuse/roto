/**
 * less.js - LESS Compiler
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


var fs = require('fs');
var path = require('path');
var async = require('async');
var less = require('less');

module.exports = function(roto) {

	roto.defineTask('less', function(callback, options, target, globalOptions) {

		var files;
		var data = [];
		var compressOptions = {};
		var cwd = process.cwd();

		console.log(roto.colorize(options.output, 'white'));

		// get matching LESS files
		if (!Array.isArray(options.ignore)) {
			options.ignore = (typeof options.ignore === 'string') ? [options.ignore] : [];
		}
		options.ignore.push(options.output);
		files = roto.findFiles(options.files, options.ignore);

		// check that we have at least one file
		if (!files.length) {
			console.error(roto.colorize('Error: ', 'red') + 'No valid files were provided.');
			return callback(false);
		}

		// check what compression is used, if is specified
		if (options.compress === 'normal') {
			compressOptions = {compress: true};
		} else if (options.compress === 'yui') {
			compressOptions = {yuicompress: true};
		}

		// translate less to css
		async.reduce(files, [], function(css, file, callback) {
			console.log(roto.colorize('   + ', 'gray') + file);

			var source = fs.readFileSync(path.resolve(cwd, file), 'utf8');
			var parserOptions = {filename: file};

			if (options.sourcemaps)
				parserOptions.dumpLineNumbers = 'mediaquery';

			var parser = new less.Parser(parserOptions);
			process.chdir(path.dirname(file));
			parser.parse(source, function(err, tree) {
				if (err) return callback(err, null);
				css.push(tree.toCSS(compressOptions));
				callback(null, css);
			});
		}, function(err, css) {

			// return to old working directory
			process.chdir(cwd);

			// error handling
			if (err) {
				console.error(roto.colorize('ERROR: ', 'red') + err.message);
				console.error('  file: ' + err.filename);
				console.error('  line: ' + err.line);
				console.error('  column: ' + err.column);

				if (Array.isArray(err.extract)) {
					console.error('  excerpt:');
					for (var i = 0; i < err.extract.length; i++) {
						if (err.extract[i].length) {
							console.error('    ' + err.extract[i]);
						}
					}
				}

				return callback(false);
			}

			var output = css.join(' ');

			// add top banner
			if (options.banner) {
				output = options.banner + '\n' + output;
			}

			// write output
			try {
				roto.writeFile(options.output, output, 'utf8')
			} catch (err) {
				console.error(roto.colorize('ERROR: ', 'red') + 'Could not write output (' + options.output + ').');
				return callback(false);
			}

			callback();

		});

	});
};

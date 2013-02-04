/**
 * uglify.js - JS Minification (uglify)
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

var fs       = require('fs'),
    uglify   = require('uglify-js'),
    colorize = require('../colorize.js');

module.exports = function(roto) {

	roto.defineTask('uglify', function(callback, options, target, globalOptions) {
		var i, ast, paths, chunks, output, source;

		roto.notice(colorize(options.output, 'white') + '\n');

		// search for matching js files
		if (!Array.isArray(options.ignore)) {
			options.ignore = (typeof options.ignore === 'string') ? [options.ignore] : [];
		}
		options.ignore.push(options.output);
		paths = roto.findFiles(options.files, options.ignore);

		// read files
		chunks = [];
		for (i = 0; i < paths.length; i++) {
			roto.notice(colorize('   + ', 'gray') + paths[i] + '\n');
			chunks.push(fs.readFileSync(paths[i], 'utf8'));
		}
		source = chunks.join('\n');

		// parse source code
		try {
			ast = uglify.parser.parse(source);
		} catch (e) {
			roto.error(colorize('ERROR:', 'red') + ' Unable to parse source.\n');

			if (e.message) {
				roto.notice('"' + e.message + '"\n');
			}

			if (typeof e.line !== 'undefined') {
				var line  = e.line - 1;
				var lines = source.split('\n');
				var start = Math.max(0, line - 4);
				var end   = Math.min(lines.length - 1, line + 4);
				for (i = start; i <= end; i++) {
					roto.notice(colorize(lines[i], i === line ? 'red' : 'gray') + '\n');
				}
				roto.notice('\n');
			}

			return callback(false);
		}

		// minify source code
		ast = uglify.uglify.ast_mangle(ast);
		ast = uglify.uglify.ast_squeeze(ast);
		output = uglify.uglify.gen_code(ast);

		// add top banner
		if (options.banner) {
			output = options.banner + '\n' + output;
		}

		// write output file
		try {
			roto.writeFile(options.output, output, 'utf8');
		} catch(err) {
			roto.error(colorize('ERROR:', 'red') + ' Unable write output (' + options.output + ').\n');
			return callback(false);
		}

		callback();
	});

}
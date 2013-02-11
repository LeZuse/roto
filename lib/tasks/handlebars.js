/**
 * handlebars.js - Handlebars Template Precompiler
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

var fs         = require('fs'),
    handlebars = require('handlebars'),
    uglify     = require('uglify-js'),
    colorize   = require('../colorize.js');

module.exports = function(roto) {

	roto.defineTask('handlebars', function(callback, options, target, globalOptions) {
		var knownHelpers = options.knownHelpers || [];
		var paths, i, name, src, ast, chunks, output;

		console.log(colorize(options.output, 'white'));

		// search for matching js files
		if (!Array.isArray(options.ignore)) {
			options.ignore = (typeof options.ignore === 'string') ? [options.ignore] : [];
		}
		options.ignore.push(options.output);
		paths = roto.findFiles(options.files, options.ignore);

		// read files
		chunks = ['Handlebars.templates=Handlebars.templates||{};'];
		for (i = 0; i < paths.length; i++) {
			name = paths[i].match(/\/([^\/]+)\.[a-zA-Z]+$/)[1];
			src  = fs.readFileSync(paths[i], 'utf8');
			console.log(colorize('   + ', 'gray') + paths[i]);
			chunks.push('Handlebars.templates["' + name + '"]=Handlebars.template(' + handlebars.precompile(src, {
				known: knownHelpers
			}) + ');');
		}
		output = chunks.join('\n');

		// compression pass
		if (options.compress) {
			try {
				ast = uglify.parser.parse(output);
			} catch (e) {
				console.error(colorize('ERROR:', 'red') + ' Unable to parse generated source.');
				return callback(false);
			}

			ast = uglify.uglify.ast_mangle(ast);
			ast = uglify.uglify.ast_squeeze(ast);
			output = uglify.uglify.gen_code(ast);
		}

		// add banner
		if (options.banner) {
			output = options.banner + '\n' + output;
		}

		// write output
		try {
			roto.writeFile(options.output, output, 'utf8');
		} catch(err) {
			console.error(colorize('ERROR:', 'red') + ' Unable write output (' + options.output + ').');
			return callback(false);
		}

		callback();
	});

}
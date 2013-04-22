/**
 * template.js - Templating
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

var fs         = require('fs');
var handlebars = require('handlebars');

module.exports = function(roto) {
	roto.defineTask('template', function(callback, options, target, globalOptions) {
		var i;
		var template;
		var files_input;
		var files_output;

		// parse options
		if (typeof options.output === 'string') {
			options.output = [options.output];
		}
		if (!options.data) {
			console.error(roto.colorize('ERROR: ', 'red') + 'No data provided for templating.');
			return callback(false);
		}

		// search for files
		files_input  = roto.findFiles(options.files, options.ignore);
		files_output = (typeof options.output === 'undefined') ? files_input : options.output;

		if (!files_input.length) {
			console.log('No matching files found for templating.');
			return callback();
		}

		if (files_input.length !== files_output.length) {
			console.error(roto.colorize('ERROR: ', 'red') + 'Number of output paths does not match number of input template paths.');
			return callback(false);
		}

		// perform templating
		for (i = 0; i < files_input.length; i++) {
			process.stdout.write(roto.colorize(files_output[i], 'white') + '\n');
			process.stdout.write(roto.colorize('   + from template: ', 'gray') + files_input[i]);

			try {
				template = handlebars.compile(fs.readFileSync(files_input[i], 'utf8'));
				roto.writeFile(files_output[i], template(options.data), 'utf8');
			} catch (err) {
				console.error('\n' + roto.colorize('ERROR: ', 'red') + err);
				return callback(false);
			}
			process.stdout.write(' [' + roto.colorize('success', 'green') + ']\n');
		}

		callback();
	});
};
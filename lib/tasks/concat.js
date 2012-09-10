/**
 * concat.js - File Concatentation Helper
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
 * @author Brian Reavis <brian@diy.org>
 */

var fs       = require('fs'),
    colorize = require('../colorize.js');

module.exports = function(roto) {
	
	roto.defineTask('concat', function(callback, options, target, globalOptions) {
		roto.notice(colorize(options.output, 'white') + '\n');

		// search for matching js files
		if (!Array.isArray(options.ignore)) {
			options.ignore = (typeof options.ignore === 'string') ? [options.ignore] : [];
		}
		options.ignore.push(options.output);
		var paths = roto.findFiles(options.files, options.ignore);

		// merge
		var chunks = [];
		if (paths.length) {
			for (var i = 0; i < paths.length; i++) {
				chunks.push(fs.readFileSync(paths[i], 'utf8'));
				roto.notice('   + ' + paths[i] + '\n');
			}

			try {
				fs.writeFileSync(options.output, chunks.join(''), 'utf8');
			} catch(err) {
				roto.error(colorize('ERROR:', 'red') + ' Unable write output (' + options.output + ').\n');
				return callback(false);
			}

			roto.notice('   = ' + options.output + '\n');
		} else {
			roto.notice('No matching files found.\n');
		}

		callback();
	});
};

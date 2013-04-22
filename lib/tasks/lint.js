/**
 * lint.js - LINT JS Validation (via jshint)
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

var _      = require('underscore');
var fs     = require('fs');
var jshint = require('jshint').JSHINT;

module.exports = function(roto) {

	roto.defineTask('lint', function(callback, options, target, globalOptions) {
		var i, j, globbed;
		var errorCount = 0;
		var jshintOptions = _.extend({
			curly: true,
			strict: false,
			smarttabs: true
		}, options.jshint);

		options = options || {};

		var analyzeFile = function(path) {
			var code = fs.readFileSync(path, 'utf8');

			process.stdout.write(roto.colorize(path, 'white'));
			if (jshint(code, jshintOptions)) {
				// success
				console.log(' [' + roto.colorize('pass', 'green') + ']');
			} else {
				// errors
				console.error(' [' + roto.colorize('fail', 'red') + ']');
				var errors = jshint.data().errors;
				for (var i = 0; i < errors.length; i++) {
					if (!errors[i]) {
						continue;
					}
					console.error('      (' + errors[i].line + ':' + errors[i].character + ') ' + errors[i].reason);
					if (typeof errors[i].evidence !== 'undefined') {
						console.error('         ' + errors[i].evidence.replace(/^\s+/, ''));
					}
					errorCount++;
				}
			}
		};

		// search for matching files
		var paths = roto.findFiles(options.files, options.ignore);

		// perform analysis
		if (paths.length) {
			paths.map(analyzeFile);
		} else {
			console.log('No matching files found.');
		}

		callback(!!errorCount);
	});

};

#!/usr/bin/env node

/**
 * Command Line Interface
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

var path     = require('path'),
    fs       = require('fs'),
    roto     = require('../lib/roto.js'),
    colorize = require('../lib/colorize.js'),
    optimist = require('optimist');

var argv = optimist.usage('Usage: $0 [target] [options]').argv;

// selected build target
// ------------------------------------------------------------------------------------

var target = argv._.length ? argv._[0] : null;

// extract global options
// ------------------------------------------------------------------------------------

var blacklist = ['_', '$0'];
var options = {};
for (var key in argv) {
	if (argv.hasOwnProperty(key) && blacklist.indexOf(key) === -1) {
		options[key] = argv[key];
	}
}
for (var i = 1; i < argv._.length; i++) {
	options[argv._[i]] = true;
}

// load project information
// ------------------------------------------------------------------------------------

var projectFile = process.cwd() + '/build.js';
var existsSync = fs.existsSync || path.existsSync;
if (!existsSync(projectFile)) {
	process.stderr.write(colorize('ERROR: ', 'red') + '"build.js" project file not found.\n');
	process.exit(1);
}

require(projectFile)(roto);

// display help
// ------------------------------------------------------------------------------------

if (options['help']) {
	var print_target = function(name, options) {
		var selected = name === roto.defaultTarget;
		var bullet   = selected ? '■' : '□';
		process.stdout.write(colorize(' ' + bullet, 'gray') + ' ' + name);
		if (selected) {
			process.stdout.write(colorize(' (default)', 'blue'));
		}
		if (options && options.description) {
			process.stdout.write(colorize(': ' + options.description + '', 'gray'));
		}
		process.stdout.write('\n');
	};

	// defined targets + 'all'
	process.stdout.write('\n' + optimist.help());
	process.stdout.write(colorize('Available Targets:\n', 'white'));
	print_target('all');
	for (var key in roto._project.targets) {
		if (roto._project.targets.hasOwnProperty(key)) {
			print_target(key, roto._project.targets[key].options);
		}
	}

	process.stdout.write('\nFor more information, find the documentation at:\n');
	process.stdout.write(colorize('http://github.com/diy/roto', 'underline') + '\n\n');
	process.exit(0);
}

// execute build
// ------------------------------------------------------------------------------------

roto.run(target, options, function(success) {
	process.exit(success !== false ? 0 : 1);
});
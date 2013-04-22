/**
 * roto - A no-nonsense build tool for Node.js projects.
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
var async     = require('async');
var fs        = require('fs');
var path      = require('path');
var glob      = require('glob');
var wrench    = require('wrench');
var minimatch = require('minimatch');
var colorize  = require('./colorize.js');


var roto = module.exports = (function() {
	var roto = {};

	var currentTarget = null;
	var taskTemplates = {};
	var atMargin      = true;

	var console_dir   = console.dir;
	var console_log   = console.log;
	var console_error = console.error;
	var write_stdout  = process.stdout.write;
	var write_stderr  = process.stderr.write;

	var project = {
		name: 'Untitled Project',
		targets: {}
	};

	roto._project = project;
	roto.defaultTarget = 'all';
	roto.dirname = __dirname.replace(/\/lib\/?$/, '');
	roto.depth = 0;
	roto.options = {
		silent: false,
		profile: false,
		indent: true,
		colorize: true
	};

	/**
	 * Colorizes a string.
	 *
	 * @param {string} string
	 * @param {string} color
	 */
	colorize = (function() {
		var fn = colorize;
		return function(str) {
			if (roto.options.colorize) {
				return fn.apply(this, arguments);
			}
			return str;
		};
	})();

	roto.colorize = colorize;

	/**
	 * Turns byte count into a human-readable filesize.
	 *
	 * @param {number} size
	 * @returns {string}
	 */
	roto.formatFilesize = function(size) {
		if (size === null || typeof size === 'undefined') {
			return 'NaN';
		}
		var tiers = ['bytes', 'KB', 'MB', 'GB', 'TB'];
		var i = 0;
		while (size >= 1024) {
			size = size / 1024;
			i++;
		}
		return Math.round(size, 1) + ' ' + tiers[i];
	};

	/**
	 * Profile targets.
	 *
	 * If option is present `endProfile` will output the profile time.
	 */
	roto.startTime = 0;
	roto.endTime   = 0;
	roto.startProfile = function () {
		roto.startTime = new Date().getTime();
	};

	roto.endProfile = function () {
		roto.endTime = new Date().getTime();
		var total = ((roto.endTime - roto.startTime) / 1000).toFixed(2);

		if (roto.options.profile === true) {
			process.stdout.write('\n');
			process.stdout.write('Finished in ' + total + 's\n');
		}
	};

	/**
	 * Performs a glob search for files relative to the project root.
	 *
	 * @param  search  A path, or array of paths, to search for. Supports glob syntax.
	 * @param  ignore  A path, or array of paths, to ignore. Supports glob syntax.
	 */
	roto.findFiles = function(search, ignore) {
		var i, j, n;
		var globbed, doignore;
		var paths = [];

		search || (search = []);
		ignore || (ignore = []);
		if (typeof ignore === 'string') { ignore = [ignore]; }

		// search for matching paths
		if (typeof search === 'string') { search = [search]; }
		for (i = 0; i < search.length; i++) {
			globbed = glob.sync(search[i].replace(/^\//, ''));
			for (j = 0; j < globbed.length; j++) {
				paths.push(globbed[j]);
			}
		}

		// filter out duplicates
		paths = _.uniq(paths);

		// filter out ignored files
		for (i = paths.length - 1; i >= 0; i--) {
			for (j = 0; j < ignore.length; j++) {
				if (minimatch(paths[i], ignore[j].replace(/^\//, ''))) {
					paths.splice(i, 1);
					break;
				}
			}
		}

		return paths;
	};

	/**
	 * Writes a file. If the parent directory doesn't
	 * exist, it will be created.
	 *
	 * @param {string} destination
	 * @param {mixed} content
	 * @param {string} encoding
	 */
	roto.writeFile = function(destination, content, encoding) {
		try {
			fs.writeFileSync(destination, content, encoding);
		} catch (e) {
			var dirname = path.dirname(destination);
			if (!fs.existsSync(dirname)) {
				wrench.mkdirSyncRecursive(dirname);
				fs.writeFileSync(destination, content, encoding);
			} else {
				throw e;
			}
		}
	};

	/**
	 * Properly formats output and passes it to `write`,
	 * which should be a reference to process.stdout.write,
	 * process.stderr.write, etc.
	 *
	 * @param {function} write
	 * @param {string} str
	 */
	var write_console = (function() {
		return function(write, str) {
			if (typeof str === 'undefined' || roto.options.silent) return;

			str = (str + '').replace(/[\r]/g, '\r' + indent('', roto.depth));

			var i, n, suffix, str;
			var depth = roto.depth;
			var lines = str.split(/[\n\u000b\u000c\u0085\u2028\u2029]/);
			var last  = lines[lines.length - 1];

			for (i = 0, n = lines.length; i < n; i++) {
				suffix = (i === n - 1) ? '' : '\n';
				str = (i > 0 || atMargin) && (i < n - 1 || lines[i] !== '') ? indent(lines[i], depth) : lines[i];
				write(str + suffix);
			}

			atMargin = last === '';
		};
	})();

	/**
	 * Indents a string.
	 *
	 * @param {string} str
	 * @param {int} depth
	 * @returns {string}
	 */
	var indent = (function() {
		var tab = roto.colorize('░ ', 'gray');
		var tabs = {};
		return function(str, depth) {
			if (!roto.options.indent) return str;

			// indentation characters
			var prefix = tabs[depth];
			if (!prefix) {
				var buffer = [];
				for (var i = 0; i < depth; i++) {
					buffer.push(tab);
				}
				prefix = tabs[depth] = buffer.join('');
			}

			// prepend to string
			return prefix + str;
		};
	})();

	/**
	 * Invoked on process.stdin "data" event.
	 */
	var onStdInData = function() {
		atMargin = true;
	};

	/**
	 * Writes a notice to the console (stdout).
	 *
	 * @deprecated
	 * @param {string} str
	 */
	roto.notice = function(str) {
		write_console(_.bind(write_stdout, process.stdout), str);
	};

	/**
	 * Writes an error to the console (stderr).
	 *
	 * @deprecated
	 * @param {string} str
	 */
	roto.error = function(str) {
		write_console(_.bind(write_stderr, process.stderr), str);
	};

	/**
	 * Sets up a target for the current project.
	 *
	 * @param {string} name - Target name.
	 * @param {object} options - Additional target information.
	 * @param {function} setup - Target execution function.
	 */
	roto.addTarget = function(name, options, setup) {
		if (typeof options === 'function') {
			setup   = options;
			options = null;
		}

		project.targets[name] = {
			name    : name,
			options : options,
			tasks   : [],
			setup   : setup
		};
	};

	/**
	 * Adds a task to the current target.
	 * Call this from a target setup method.
	 *
	 * Usage:
	 *
	 *     roto.addTask('lint', {
	 *        files: 'something.js'});
	 *     });
	 *
	 *     roto.addTask(function(callback) {
	 *         console.log('Do something');
	 *         callback();
	 *     });
	 *
	 * @param {mixed} method   Callback, or name of the predefined task.
	 * @param {oject} options  An object containing configuration info
	 *                         for the task when it executes.
	 */
	roto.addTask = function() {
		var target = currentTarget;
		var taskName = arguments[0];
		var taskOptionsData = arguments.length > 1 ? arguments[1] : null;
		var taskOptions;

		// allow for options to be computed at task execution time
		if (typeof taskOptionsData === 'function') {
			taskOptions = taskOptionsData;
		} else {
			taskOptions = function() {
				return taskOptionsData;
			};
		}

		// sanity check
		if (!target) {
			console.error(colorize('ERROR:', 'red') + ' roto.addTask() can only be called within the roto.addTarget() callback.');
			return false;
		}

		// add method to task list of the current target
		if (typeof taskName === 'function') {
			target.tasks.push(function(options, callback) {
				taskName(callback, taskOptions(), target, options);
			});
		} else {
			target.tasks.push(function(options, callback) {
				roto.executeTask(taskName, taskOptions(), function() {
					callback.apply(null, arguments);
				});
			});
		}
	};

	/**
	 * Defines a task so that it can be invoked later,
	 * one or more times.
	 *
	 * @param {string} name  Name of the task.
	 * @param {function} callback  Function that performs the task.
	 */
	roto.defineTask = function(name, callback) {
		taskTemplates[name] = callback;
	};

	/**
	 * Invokes a named task.
	 *
	 * @param {string} name
	 * @param {object} options
	 * @param {function} callback
	 */
	roto.executeTask = function(name, options, callback) {
		if (name.indexOf('target:') === 0) {
			roto.executeTarget(name.replace(/^target\:\s*/, ''), options, callback);
		} else {
			if (typeof taskTemplates[name] !== 'function') {
				console.error(colorize('ERROR:', 'red') + ' "' + taskName + '" task not defined.');
				return callback(false);
			}
			taskTemplates[name](callback, options, currentTarget, roto.buildOptions);
		}
	};

	/**
	 * Executes a single target.
	 *
	 * @param {string} name  The name of the target.
	 * @param {object} options  Configuration options to pass to the target.
	 * @param {function} callback  Invoked upon completion.
	 */
	roto.executeTarget = function(name, options, callback) {
		var oldTarget = currentTarget;
		var target = project.targets[name];

		// prepare
		currentTarget = target;
		if (roto.options.indent) {
			console.log(colorize('▾ target:' + target.name, 'blue'));
		} else {
			console.log(colorize('Running target: ' + target.name + '...', 'blue'));
		}
		roto.depth++;
		target.tasks = [];
		target.setup(options);

		// execute child tasks
		async.mapSeries(target.tasks, function(task, callback) {
			task(options, function(result) {
				process.nextTick(function() {
					if (result === false) {
						return callback('Task failed');
					} else {
						return callback();
					}
				});
			});
		}, function(err) {
			currentTarget = null;
			roto.depth--;
			return callback(!err);
		});
	};

	/**
	 * Invoked when a build begins.
	 */
	roto.onBuildStart = function() {
		console.log   = function() { roto.notice(Array.prototype.join.apply(arguments, [' ']) + '\n'); };
		console.error = function() { roto.error(Array.prototype.join.apply(arguments, [' ']) + '\n'); };
		console.dir   = function() {
			try { roto.notice(Array.prototype.join.apply(_.map(arguments, JSON.stringify), [' ']) + '\n'); }
			catch (e) { console.log.apply(this, arguments); }
		};
		process.stdout.write = roto.notice;
		process.stderr.write = roto.error;
		process.stdin.on('data', onStdInData);
	};

	/**
	 * Teardown method invoked after a build completes.
	 */
	roto.onBuildEnd = function() {
		roto.endProfile();
		currentTarget = null;
		console.log   = console_log;
		console.error = console_error;
		console.dir   = console_dir;
		process.stdout.write = write_stdout;
		process.stderr.write = write_stderr;
		process.stdin.removeListener('data', onStdInData);
	};

	/**
	 * Build it!
	 *
	 * @param {string} targetName  The name of the target you want to build.
	 *                             Use an array of target names to build multiple
	 *                             targets at once. To build all targets, use "all".
	 * @param {object} options     An object containing global options, provided
	 *                             to all tasks.
	 * @param {function} callback  Invoked upon build completion.
	 */
	roto.run = function(targetName, options, callback) {
		var i, oldGlobals;

		// setup
		atMargin = true;
		targetName = targetName || roto.defaultTarget;
		options = options || {};
		roto.depth = 0;
		root.buildOptions = options;
		roto.onBuildStart();

		// determine selected targets
		var selectedTargets = [];
		if (typeof targetName === 'string') {
			targetName = targetName.toLowerCase();
			if (targetName === 'all') {
				for (var key in project.targets) {
					if (project.targets.hasOwnProperty(key)) {
						selectedTargets.push(key);
					}
				}
			} else {
				selectedTargets.push(targetName);
			}
		} else if (Array.isArray(targetName)) {
			for (i = 0; i < targetName.length; i++) {
				selectedTargets.push(targetName[i]);
			}
		}

		// check that all targets exist
		if (!selectedTargets.length) {
			console.error(colorize('ERROR:', 'red') + ' No matching build targets were found.');
			console.error('       Run with ' + colorize('--help', 'white') + ' to see available targets.');
			return false;
		}

		for (i = 0; i < selectedTargets.length; i++) {
			if (!project.targets.hasOwnProperty(selectedTargets[i])) {
				console.error(colorize('ERROR:', 'red') + ' "' + selectedTargets[i] + '" target not found.');
				return false;
			}
		}

		// build selected targets
		roto.startProfile();
		async.mapSeries(selectedTargets, function(target, callback) {
			roto.executeTarget(target, options, function(result) {
				process.nextTick(function() {
					if (result === false) {
						return callback('Target failed.');
					} else {
						return callback();
					}
				});
			});
		}, function(err) {
			roto.onBuildEnd();
			callback && callback(!err);
		});
	};

	return roto;
})();

require(__dirname + '/tasks/concat.js')(roto);
require(__dirname + '/tasks/handlebars.js')(roto);
require(__dirname + '/tasks/lint.js')(roto);
require(__dirname + '/tasks/s3.js')(roto);
require(__dirname + '/tasks/uglify.js')(roto);
require(__dirname + '/tasks/mocha.js')(roto);
require(__dirname + '/tasks/less.js')(roto);
require(__dirname + '/tasks/png.js')(roto);
require(__dirname + '/tasks/dir.js')(roto);
require(__dirname + '/tasks/template.js')(roto);
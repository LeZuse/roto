# roto

#### A no-nonsense build tool for Node.js projects.

Roto is designed to be a lean build tool. Build targets are defined as functions. Inside of which, simply add tasks that are executed *sequentally*. Roto is in its very early stages—use it with some caution.

**To install**: `npm install -g roto`

## Bundled Tasks

A few common, useful tasks come built-in to roto.

* [**s3**](docs/task_s3.md) — Syncs a local folder to S3.
* [**concat**](docs/task_concat.md) — Concatenates two or more files.
* [**handlebars**](docs/task_handlebars.md) — Precompiles [Handlebars](http://handlebarsjs.com/) templates to JS.
* [**lint**](#) — Validates Javascript source code (using [jshint](https://github.com/jshint/jshint/)).
* [**uglify**](docs/task_uglify.md) — Minifies Javascript source code (using [uglifyjs](https://github.com/mishoo/UglifyJS)).
* [**mocha**](docs/task_mocha.md) — Performs unit tests (using [mocha](http://visionmedia.github.com/mocha/)).
* [**less**](docs/task_less.md) — Precompiles [LESS stylesheets](http://lesscss.org/) to raw CSS.
* [**png**](docs/task_png.md) — A suite of various PNG optimization tools (pngcrush, pngquant, and optipng).
* [**dir-copy**](docs/task_dir-copy.md) — Copies a directory and its contents.
* [**dir-move**](docs/task_dir-move.md) — Moves a directory and its contents.
* [**dir-remove**](docs/task_dir-remove.md) — Deletes a directory and its contents.
* [**template**](docs/task_template.md) — Generates a file from a template.

## Setting up a Project

Create a `build.js` file in your project root. This is where you'll define all your build targets and set up the tasks that make up those targets. Here's the basic idea:

```javascript
module.exports = function(roto) {
	roto.addTarget('www', function(options) {
		// minify js files
		roto.addTask('uglify', {
			files  : ['js/*.js'],
			ignore : ['js/*.min.js'],
			output : 'js/combined.min.js'
		});

		// do something custom
		roto.addTask(function(callback) {
			console.log('This isn\'t using a predefined task. Saweet.');
			callback();
		});
	});
};
```

To set the **default target** that is used (should one not be given at build time), set `roto.defaultTarget`. If left unchanged, **all** targets are built.

```javascript
roto.defaultTarget = 'target-name';
```

### Adding Predefined Tasks

To invoke a predefined task as part of your build process, use `roto.addTask(name, options)`—where `name` is the name of the predefined task. For `options`, consult the documentation for that task ([located here](#bundled-tasks)).

```javascript
roto.addTask('uglify', {
	files  : ['js/*.js'],
	ignore : ['js/*.min.js'],
	output : 'js/combined.min.js'
});
```

In more complicated builds, task options might need to be computed at execution time. This can be done by providing a function instead of an object:

```javascript
roto.addTask('uglify', function() {
	return {
		files  : ['js/*.js'],
		ignore : ['js/*.min.js'],
		output : 'js/combined.min.js'
	}
});
```

### Adding Custom Tasks

If there's something specific you need to do that doesn't have to do with a predefined task, simply use `roto.addTask(callback)`:

```javascript
roto.addTask(function(callback) {
	// logic goes here
	callback();
});
```

### Executing Other Targets

In some cases, executing another target from the current target makes sense (e.g. a "deploy" target needing to run the "clientside-build" target first). To do this, use the following syntax:

```javascript
roto.addTask('target:clientside-build', options);
```

### Invoking Tasks Within Other Tasks

Predefined tasks can be manually invoked using the "executeTask" method, like so:

```javascript
roto.addTask(function(callback) {
	roto.executeTask('uglify', options, callback);
});
```

## Odds & Ends

### Colorizing Strings

A utility for colorizing strings comes bundled with roto.

```javascript
var colorize = roto.colorize;

console.error(colorize('ERROR:', 'red') + ' Something borked.');
console.log(colorize('SUCCESS:', 'green') + ' Something went right!');
```

The available colors are currently: `red`, `yellow`, `green`, and `white` (bold).

### Defining Reusable Tasks

For defining custom tasks that can be reused (like the predefined ones that come bundled with roto), use:

```javascript
roto.defineTask(name, function(callback, options, target, globalOptions) {
	// logic goes here
	callback();
});
```

The arguments provided to the callback are:

* `callback` – Invoke to move on to the next task. This is crucial (otherwise your build will hang).
* `options` — User-provided options that are given when calling `roto.addTask`.
* `target` — Information about the target currently being executed `{ name: 'target-name', tasks: [...] }`.
* `globalOptions` — Options provided at the command line, or when calling `roto.run`.

## Executing a Build

### From Javascript

```javascript
var roto = require('roto');
require('./build.js')(roto);

// build a single target
roto.run('target-name', {}, function(success) {
	console.log('Build complete!');
});

// build a few targets
roto.run(['target-name', 'whatevs'], {}, function(success) {
	console.log('Build complete!');
});
```

### Command Line

    roto target [options]

#### Options

Options can be provided in a variety of ways:

	roto target debug --message=hello -x 1 -y 2

This leads to `options` being:

```javascript
{
	debug: true,
	message: 'hello',
	x: 1,
	y: 2
}
```
# less (bundled task)

Pre-compiles [LESS stylesheets](http://lesscss.org/) to a raw CSS file.

## Options

<table>
	<tr>
		<th>Option</th>
		<th width="220px">Type</th>
		<th>Comment</th>
	</tr>
	<tr>
		<td valign="top"><code>files</code></td>
		<td valign="top"><code>string</code> (or <code>array</code> of strings)</td>
		<td valign="top">Paths of files to be concatenated. Supports basic wildcards / <a href="http://www.linuxjournal.com/content/bash-extended-globbing" target="_blank">glob syntax</a>.</td>
	</tr>
	<tr>
		<td valign="top"><code>ignore</code></td>
		<td valign="top"><code>string</code> (or <code>array</code> of strings)</td>
		<td valign="top">Any matching paths will be ignored. Also supports glob syntax.</td>
	</tr>
	<tr>
		<td valign="top"><code>compress</code></td>
		<td valign="top"><code>string</code></td>
		<td valign="top">Defines what type of compression to use. Either 'normal' or 'yui'. Optional.</td>
	</tr>
	<tr>
		<td valign="top"><code>output</code></td>
		<td valign="top"><code>string</code></td>
		<td valign="top">Path of the output file.</td>
	</tr>
	<tr>
		<td valign="top"><code>sourcemaps</code></td>
		<td valign="top"><code>bool</code></td>
		<td valign="top">If true the output will contain <code>@media --sass-debug-info</code> style sourcemaps. Must be using Chrome ~26 with <strong>unminifed</strong> output.</td>
	</tr>
	<tr>
		<td valign="top"><code>banner</code></td>
		<td valign="top"><code>string</code></td>
		<td valign="top">Raw text appended to the top of the generated output. Useful for copyright notices.</td>
	</tr>
</table>

## Examples

```javascript
roto.addTask('less', {
	files    : 'css/*.less'
	ignore   : 'css/nobody_wants_me.less',
	compress : 'yui',
	output   : 'css/stylesheet.less'
});
```

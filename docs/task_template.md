# template (bundled task)

Generates a file from a template using [handlebars.js markup](http://handlebarsjs.com/).

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
		<td valign="top">Paths of template files. Does <strong>not</strong> support glob syntax.</td>
	</tr>
	<tr>
		<td valign="top"><code>output</code></td>
		<td valign="top"><code>string</code> (or <code>array</code> of strings)</td>
		<td valign="top">Paths of output file(s). If an array, is provided it should match the length of "files" (they map 1:1). If "output" is <em>not</em> provided, the input files will be templated and replaced.</td>
	</tr>
	<tr>
		<td valign="top"><code>data</code></td>
		<td valign="top"><code>object</code></td>
		<td valign="top">Data to used for templating.</td>
	</tr>
</table>

## Examples

```javascript
roto.addTask('template', {
	files  : 'src/config.xml'
	output : 'build/config.xml',
	data   : {version: '1.0.0'}
});
```

```javascript
roto.addTask('template', {
	files  : ['output/config.xml', 'output/readme.html']
	data   : {version: '1.0.0'}
});
```
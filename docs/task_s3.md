# s3 (bundled task)

Syncing a folder to S3 is really easy using the `s3` task. Provide the task with S3 credentials and the path of a local folder, and it will transfer the contents to S3. It maintains a remote manifest of files and their checksums so that later sync operations won't have to upload files that haven't changed (ala git / dropbox).

## Options

<table>
	<tr>
		<th>Option</th>
		<th width="220px">Type</th>
		<th>Comment</th>
	</tr>
	<tr>
		<td valign="top"><code>key</code></td>
		<td valign="top"><code>string</code></td>
		<td valign="top">S3 authorization key.</td>
	</tr>
	<tr>
		<td valign="top"><code>private</code></td>
		<td valign="top"><code>string</code></td>
		<td valign="top">Private S3 authrorization key.</td>
	</tr>
	<tr>
		<td valign="top"><code>acl</code></td>
		<td valign="top"><code>string</code></td>
		<td valign="top">The value of the <a href="http://docs.amazonwebservices.com/AmazonS3/latest/dev/ACLOverview.html#CannedACL">x-amz-acl</a> header (used to control file visibility). Default: "public-read"</td>
	</tr>
	<tr>
		<td valign="top"><code>method</code></td>
		<td valign="top"><code>string</code></td>
		<td valign="top">The name of the operation to perform (currently only `sync`).</td>
	</tr>
	<tr>
		<td valign="top"><code>folder</code></td>
		<td valign="top"><code>string</code></td>
		<td valign="top">Path to the local folder to sync to S3.</td>
	</tr>
	<tr>
		<td valign="top"><code>destination</code></td>
		<td valign="top"><code>string</code></td>
		<td valign="top">The path to the folder in the bucket to place the files. Default: "/"</td>
	</tr>
	<tr>
		<td valign="top"><code>files</code></td>
		<td valign="top"><code>string</code> (or <code>array</code> of strings)</td>
		<td valign="top">Paths of files within <code>folder</code> to be synced. Supports basic wildcards / <a href="http://www.linuxjournal.com/content/bash-extended-globbing" target="_blank">glob syntax</a>.</td>
	</tr>
	<tr>
		<td valign="top"><code>ignore</code></td>
		<td valign="top"><code>string</code> (or <code>array</code> of strings)</td>
		<td valign="top">Any matching paths in `folder` will be ignored. Supports glob syntax.</td>
	</tr>
	<tr>
		<td valign="top"><code>headers</code></td>
		<td valign="top"><code>object</code></td>
		<td valign="top">Any headers to apply to all files.</td>
	</tr>
	<tr>
		<td valign="top"><code>gzip</code></td>
		<td valign="top"><code>bool</code></td>
		<td valign="top">If true, each file will also have a gzipped version uploaded. For example, if you have "script.js", the gzipped version will exist at "script.gz.js". Default: false.</td>
	</tr>
	<tr>
		<td valign="top"><code>bucket</code></td>
		<td valign="top"><code>string</code></td>
		<td valign="top">The name of the S3 bucket to use.</td>
	</tr>
	<tr>
		<td valign="top"><code>concurrency</code></td>
		<td valign="top"><code>int</code></td>
		<td valign="top">How many simultaneous uploads to allow. Default: 3.</td>
	</tr>
	<tr>
		<td valign="top"><code>ttl</code></td>
		<td valign="top"><code>int</code></td>
		<td valign="top">The cache lifetime given to browsers requesting the files from S3 (in seconds). Default: 2678400 (31 days).</td>
	</tr>
	<tr>
		<td valign="top"><code>manifest</code></td>
		<td valign="top"><code>string</code></td>
		<td valign="top">The filename of the generated manifest used for delta calculations. Default: ".manifest.json"</td>
	</tr>
	<tr>
		<td valign="top"><code>force</code></td>
		<td valign="top"><code>bool</code></td>
		<td valign="top">Force all files to be updated (even if they haven't changed).</td>
	</tr>
	<tr>
		<td valign="top"><code>file_headers</code></td>
		<td valign="top"><code>object</code></td>
		<td valign="top">An object mapping file patterns to a list of headers. If provided, "ttl" and "acl" are re-written to "Cache-Control" and "x-amz-acl", respectively.</td>
	</tr>
</table>

## Examples

### Entire Folder

```javascript
// sync entire folder
roto.addTask('s3', {
	folder: 'public',
	ignore: ['**/*.less'],
	key: '*****',
	secret: '*************************',
	bucket: 'org-static',
	destination: '/',
	ttl: 32140800,
	file_headers: {
		'**/*.gif': {ttl: 3600},
		'**/*.p12': {acl: 'private'}
	}
});

### Individual Files

```javascript
roto.addTask('s3', {
	folder: '/',
	files: '**/*.js',
	ignore: ['**/*.min.js'],
	key: '*****',
	secret: '*************************',
	bucket: 'org-static',
	destination: '/',
	ttl: 32140800,
	file_headers: {
		'**/*.gif': {ttl: 3600},
		'**/*.p12': {acl: 'private'}
	}
});

// src/file.js -> org-static/src/file.js
// src/lib/file.js -> org-static/src/lib/file.js
```

```javascript
roto.addTask('s3', {
	folder: '/src',
	files: '**/*.js',
	ignore: ['**/*.min.js'],
	key: '*****',
	secret: '*************************',
	bucket: 'org-static',
	destination: '/',
	ttl: 32140800,
	file_headers: {
		'**/*.gif': {ttl: 3600},
		'**/*.p12': {acl: 'private'}
	}
});

// src/file.js -> org-static/file.js
// src/lib/file.js -> org-static/lib/file.js
```
<?php 
	
	//error_reporting(E_ALL);
	//ini_set('display_errors', '1');

	require_once('includes/getid3/getid3.php');

	define( 'FILE_SIZE_LIMIT', '102400' );
	define( 'DIR_UPLOADS', '' );
	
	$allowed_types = array(
		'audio/mpeg'	=> true,
		'audio/mp3'		=> true,
		'audio/aac'		=> true
	);
	$allowed_extensions = array(
		'mp3'	=> true,
		'aac'	=> true
	);

	header('Vary: Accept');
	if (isset($_SERVER['HTTP_ACCEPT']) &&
	    (strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false)) {
	    header('Content-type: application/json');
	} else {
	    header('Content-type: text/plain');
	}
	
	//-check for no file
	if( empty($_FILES['files']) )
	{
		echo json_encode(array(
			'files'=>array(),
			'error'=>'No files sent'
		));
		exit;
	}

	//-check user and token
	if( empty($_POST['id']) )
	{
		echo json_encode(array(
			'files'=>array(),
			'error'=>'No user id sent'
		));
		exit;
	}
	if( empty($_POST['token']) )
	{
		echo json_encode(array(
			'files'=>array(),
			'error'=>'No user token sent'
		));
		exit;
	}
	//-connect to db
	$dbc = mysqli_connect('');
	if( !$dbc )
	{
		echo json_encode(array(
			'files'			=>array(),
			'error'			=>'Could not connect to db',
			'mysql_error' 	=> mysqli_connect_error()
		));
		exit;
	}
	$clean_id = mysqli_real_escape_string( $dbc, $_POST['id'] );
	$query = "SELECT * FROM `users` WHERE `google_id` = '{$clean_id}' LIMIT 1;";
	$results = mysqli_query( $dbc, $query );
	if( mysqli_num_rows($results) !== 1 )
	{
		echo json_encode(array(
			'files'=>array(),
			'error'=>'No user found in db'
		));
		exit;
	}
	$row = mysqli_fetch_assoc( $results );
	if( $row['token'] !== $_POST['token'] )
	{
		echo json_encode(array(
			'files'=>array(),
			'error'=>'Token mismatch'
		));
		exit;
	}

	//-fix $_FILES array
	$upload_array = array();
    if( is_array($_FILES['files']['name']) )
    {
    	$lt_keys = array_keys( $_FILES['files'] );
    	$run = count( $_FILES['files']['name'] );
    	for( $i=0; $i<$run; $i++ )
    	{
    		foreach( $lt_keys as $key )
    		{
    			$upload_array[$i][$key] = $_FILES['files'][$key][$i];
    		}
    	}
    }
    else
    {
    	$upload_array[] = $_FILES['files'];
    }

	$files = array();
	$i = 0;
	foreach( $upload_array as $FILE )
	{
		if( !is_uploaded_file($FILE['tmp_name']) )
		{
			$files[$i]['error'] = 'Could not find uploaded file.';
			$files[$i]['upload_array'] = $upload_array;
			$files[$i]['file_array'] = $FILE;
			$files[$i]['file_super'] = $_FILES;
			$files[$i]['file_tmp_name'] = $FILE['tmp_name'];
			continue;
		}

		//-check file size limit
		if( ($FILE['size'] / 1024) > FILE_SIZE_LIMIT || $FILE['error'] == 1 )
		{
			$files[$i]['error'] = 'File was too large. Maximum filesize for the image is 10Mb.';
			continue;
		}

		//-check for errors
		if( $FILE['error'] )
		{
			$files[$i]['error'] = 'An error occurred uploading your file. Please try again later.';
			continue;
		}

		//-check file type
		if( !array_key_exists(strtolower($FILE['type']),$allowed_types))
		{
			$files[$i]['error'] = "The uploaded file needs to be an file. Provided type was: {$FILE['type']}";
			continue;
		}

		//-check extension
		$ext = @strtolower( end(explode('.', $FILE['name'])) );
		if( !array_key_exists($ext,$allowed_extensions))
		{
			$files[$i]['error'] = 'The uploaded file needs to be an MP3, M4A, or AAC (with the appropriate extension).';
			continue;
		}

		//-get id3 tags
		$getID3 = new getID3;
		$tag = $getID3->analyze( $FILE['tmp_name'] );
		$files[$i]['title'] = '';
		$files[$i]['artist'] = 'Unknown';

		//-set artist
		if( !empty($tag['tags']['id3v2']['artist'][0]) )
		{
			$files[$i]['artist'] = $tag['tags']['id3v2']['artist'][0];
		}
		if( !empty($tag['id3v1']['artist']) )
		{
			$files[$i]['artist'] = $tag['id3v1']['artist'];
		}
		//-set title
		if( !empty($tag['tags']['id3v2']['title'][0]) )
		{
			$files[$i]['title'] = $tag['tags']['id3v2']['title'][0];
		}
		if( !empty($tag['id3v1']['title']) )
		{
			$files[$i]['title'] = $tag['id3v1']['title'];
		}
		if( $files[$i]['title'] == '' )
		{
			$files[$i]['title'] = $FILE['name'];
		}

		//-create new file name
		$new_file_name = $files[$i]['artist'] . '_-_' . $files[$i]['title'];
		$new_file_name = preg_replace( '/[^a-zA-Z0-9\-_]{1,}/', '_', $new_file_name );
		$test_name = $new_file_name;
		$j=0;
		while(
			$j++ < 1000 && 
			file_exists( DIR_UPLOADS . $test_name . '.mp3' )
		){
			$test_name = $new_file_name . "-{$j}";
		}
		if( $j === 999 )
		{
			$files[$i]['error'] = 'Too many previous uploads with the same file name!';
			continue;
		}
		$new_file_name = "{$test_name}.{$ext}";
		$files[$i]['file'] = $new_file_name;
		
		//-move file
		if( !move_uploaded_file($FILE['tmp_name'], DIR_UPLOADS.$new_file_name) )
		{
			$files[$i]['error'] = 'An error occurred uploading your file. Please try again later.';
			continue;
		}

		$files[$i]['error'] = '';
		$files[$i]['length'] = ceil($tag['playtime_seconds']);

		$now = date('U');
		$clean = array();
		foreach( $files[$i] as $key => $value )
		{
			$clean[$key] = mysqli_real_escape_string( $dbc, $value );
		}
		$query = 
			"INSERT INTO `tracks` 
			(`title`,`artist`,`file`,`filetype`,`length`,`uploadedBy`,`date_added`,`date_modified`) 
			VALUES 
			(
				'{$clean['title']}',
				'{$clean['artist']}',
				'{$clean['file']}',
				'{$ext}',
				'{$clean['length']}', 
				'{$clean_id}', 
				'{$now}',
				'{$now}'
			);";
		$success = mysqli_query( $dbc, $query );
		if( !$success )
		{
			$files[$i]['error'] = 'Could not add song to database';
			$files[$i]['mysql_error'] = mysqli_error( $dbc );
			continue;
		}
		else
		{
			$files[$i]['trackId'] = mysqli_insert_id( $dbc );
		}

		$i++;
	}

	echo json_encode(array(
		'files'			=> $files,
		'error'			=> '',
	));
	exit;

?>
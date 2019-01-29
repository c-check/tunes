var express  = require('express');
var app      = express();
var session  = require('express-session');
var passport = require('passport')
  , GoogleStrategy = require('passport-google-oauth20').Strategy;
var ensureLogin = require('connect-ensure-login');
var http  = require('http').Server(app);
var io    = require('socket.io')(http);
var uuid  = require('uuid');
var mysql = require('mysql');
var connection = mysql.createConnection({
  host     : '',
  user     : '',
  password : '',
  database : ''
});
connection.connect();

var charset='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
t={},
q=[],
recent=[],
peeps=[],peepids=[];

//-google authentication
passport.use(
	new GoogleStrategy(
		{
		clientID: '',
		clientSecret: '',
		callbackURL: ''
		},
		function(accessToken, refreshToken, profile, cb) {
	  	
		  	error=null;

		  	console.log('this user connected:');
		  	console.log(JSON.stringify(profile));

		    //-find or create user in database
		    var googid=connection.escape(profile.id),
		    uploadToken=connection.escape(uuid.v1()),
		    //-update user photo
		    userPhoto=profile.photos.length>0?connection.escape(profile.photos[0].value):'NULL';

		    var u={},
			now=Math.floor(Date.now() / 1000),
		    quickquery='UPDATE `users` SET `token` = '+uploadToken+', `photo` = '+userPhoto+', `date_modified` = '+now+' WHERE `google_id` = '+googid+' LIMIT 1;';
			connection.query(quickquery,function(err,result){
				if(err||!result.changedRows){
					//-could not find, adding to prospective db
					console.log('adding user to database');
					var last=connection.escape(profile.name.familyName),
					first=connection.escape(profile.name.givenName),
					insquery = 'INSERT INTO `requests` (`google_id`,`last`,`first`,`token`,`date_created`,`date_modified`) VALUES ('+
							googid+','+
							last+','+
							first+','+
							uploadToken+','+
							now+','+
							now+');';
					connection.query(insquery ,function(err,result){
						if(err||result.insertId===null){
							console.log('failed to add user to database: '+err.code);
							console.log('query:');
							console.log(insquery);
							error='failed insert';
						}
					});
					error = 'Please send a request to curtishiller@gmail.com to get access rights!';
				}
			});

		    return cb(error, profile);
		}
	)
);
passport.serializeUser(function(user, cb) {
  cb(null, user);
});
passport.deserializeUser(function(obj, cb) {
  cb(null, obj);
});

app.use(express.static(__dirname));
app.set('views', __dirname + '/templates');
app.set('view engine', 'ejs');

app.use(session({
  genid: function(req) {
    return uuid.v4();
  },
  resave:false,
  saveUninitialized:false,
  secret: ''
}))
app.use(passport.initialize());
app.use(passport.session());

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login')
}

app.get('/',

	//-require login for root
	ensureLogin.ensureLoggedIn(),

	function(req, res){
		//-select all user info
		var googid=connection.escape(req.user.id),
		userquery='SELECT * FROM `users` WHERE `google_id` = '+googid+' LIMIT 1;',
		u={};
		connection.query(userquery,function(err,rows,fields){
			//-redirect to error
			if(err){
				console.log('error loading user '+googid);
				res.redirect('/error?e=f');
			}
			else if( rows.length !== 1 ){
				console.log('user given the runaround lol :'+googid);
				res.redirect('/error?e=r');
			}
			//-build music page
			else{
				u={
					id:rows[0].google_id,
					nickname:rows[0].nickname? rows[0].nickname : rows[0].first,
					firstName:rows[0].first,
					lastName:rows[0].last,
					token:rows[0].token
				};
				console.log('LOGIN (user request music):');
				console.log(JSON.stringify(u));
				res.render('music', { USER: u });
			}
		});
	}
);
app.get('/login', function(req, res){
  res.render('login', { USER: req.user });
});
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] })
 );
app.get('/auth/google/callback', 
	passport.authenticate('google', { failureRedirect: '/login' }),
	function(req, res) {
		res.redirect('/');
	}
);
app.get('/error', function(req,res){
	console.log('req.params');
	console.log(JSON.stringify(req.query));
	res.render('error',{e:req.query.e});
});

function createToken(len){
	if(len==null){
		len=16;
	}
	var toke='';
	while(toke.length<len)
	{
		toke+=charset.charAt(Math.floor(Math.random()*61));
	}
	return toke;
}

function playTrack(t){
	//-create new token
	t.token=createToken(16);
	//-set started time
	t.startTime=Math.floor(Date.now() / 1000);

	io.emit('track',t);
	console.log('new track playing:');
	console.log(JSON.stringify(t));
}

function testPacketUserToken(packet){
	var googid = connection.escape(packet.user.id);
	var query='SELECT `token` FROM `users` WHERE `google_id` = '+googid+' LIMIT 1;';
	connection.query(query,function(err,rows,fields){
		if(err){
			return {
				error:true,
				code:err.code
			};
		}
		else{
			if(rows.length!==1){
				return {
					error:true,
					code:'no user'
				};
			}
			else{
				if(rows[0].token!==packet.user.token){
					return {
						error:true,
						code:'bad token'
					};
				}
			}
		}
	});
	return {error:false};
}

io.on('connection', function(socket){

	//-handle disconnect
	socket.on('disconnect',function(){
		console.log('DISCONNECT: '+socket.id);
		var pid=peepids[socket.id];
		peeps.splice(pid,1);
		peepids.splice(socket.id,1);
		io.emit('peeps',peeps);
		return true;
	});

	//-responsd to initial status requests
	socket.on('init',function(packet){
		console.log('REQUEST (init):');
		console.log(JSON.stringify(packet));

		var pt=testPacketUserToken(packet);
		if(pt.error){
			socket.emit('initError',pt.code);
			console.log('ERROR (initError): '+pt.code);
			return false;
		}

		//-add to peeps
		var next=peeps.length;
		peepids[next]=socket.id;
		peeps.push({
			socketId:socket.id,
			id:packet.user.id,
			nickname:packet.user.nickname
		});
		io.emit('peeps',peeps);

		//-determine track lag time
		if(Object.keys(t).length){
			t.m=Math.floor(Date.now() / 1000)-t.startTime;
		}
		socket.emit('track',t);

		socket.emit('queue',q);
		socket.emit('recent',recent);
	});

	//-respond to track ending
	socket.on('trackEnd',function(packet){
		console.log('track ended. packet received: '+JSON.stringify(packet));
		console.log('current track: '+t.token);

		var pt=testPacketUserToken(packet);
		if(pt.error){
			socket.emit('trackEndError',pt.code);
			return false;
		}

		var token = packet.trackToken;
		if(token!==t.token){
			return false;
		}
		var itid=connection.escape(t.trackId),
		itype=connection.escape(t.type),
		idj=connection.escape(t.djid),
		googid=connection.escape(packet.user.id),
		now=connection.escape(Math.floor(Date.now() / 1000));
		var playedq='INSERT INTO `played` (`trackId`,`type`,`user_id`,`time`) VALUES ('+itid+','+itype+','+idj+','+now+');';
		try{
			connection.query(playedq,function(err,results){
				if(err){
					console.log('could not update "played" list:'+err.code);
					console.log(playedq);
				}
			});
		}catch(e){};

		//-add to recent
		console.log('adding to recent:');
		console.log(JSON.stringify(t));
		recent.unshift(t);
		if(recent.length>50){
			recent.pop();
		}
		io.emit('recent',recent);

		if(q.length===0){
			t={};
			io.emit('track',t);
			console.log('Empty queue.');
		}
		else
		{
			//-pull next song from queue
			t=q.shift();
			//-emit track to listeners
			playTrack(t);

			io.emit('queue',q);

			console.log('Next song.');
		}
	});

	//-queue update
	socket.on('queueUpdate',function(packet){
		console.log('new queue received:');
		console.log(JSON.stringify(packet));

		var pt=testPacketUserToken(packet);
		if(pt.error){
			socket.emit('queryUpdateError',pt.code);
			return false;
		}

		var nq=packet.q;

		connection.query('SELECT * FROM `tracks`;',function(err,rows,fields){
			var tbyid=[],
			r,temp;
			q=[];
			while(rows.length){
				r=rows.shift();
				tbyid[r.trackId]=r;
			};
			while(nq.length){
				r=nq.shift();
				console.log('new queue item:');
				console.log(JSON.stringify(r));
				if(r.type==='file'){
					temp=tbyid[r.trackId];
					temp.djname=r.djname;
					temp.djid=r.djid;
					temp.type='file';
					q.push(temp);
				}
				if(r.type==='youtube'){
					q.push(r);
				}
				console.log('new full queue:');
				console.log(JSON.stringify(q));
			};
			if(!Object.keys(t).length){
				t=q.shift();
				playTrack(t);
				socket.emit('queue',q);
			}
			socket.broadcast.emit('queue',q);
		});
	});

	//-respond to files request
	socket.on('getAllFiles',function(){
		console.log('REQUEST (getAllFiles): '+socket.id);
		var quer='SELECT * FROM `tracks` ORDER BY `artist` ASC;';
		connection.query(quer,function(err,rows,fields){
			if(err){
				socket.emit('getAllFilesError',err.code);
				console.log('error retrieving files: '+err.code);
				console.log('query: '+quer);
				return false;
			}
			else{
				socket.emit('allFiles',rows);
				return true;
			}
		});
	});

	//-handle file upload
	socket.on('fileUploaded',function(){
		connection.query('SELECT * FROM `tracks` ORDER BY `artist` ASC;',function(err,rows,fields){
			socket.broadcast.emit('allFiles',rows);
			var r;
			files=[];
			while(rows.length){
				r=rows.shift();
				if(r!==null){
					files[r.trackId]=r;
				}
			};
		});
	});

	//-respond to favorites request
	socket.on('getFavorites',function(packet){
		console.log('REQUEST (favorites) packet:');
		console.log(JSON.stringify(packet));

		var pt=testPacketUserToken(packet);
		if(pt.error){
			socket.emit('getFavoritesError',pt.code);
			return false;
		}

		var googid=connection.escape(packet.user.id);
		var quer='SELECT * FROM `favorites` WHERE `google_id` = '+googid+';';
		connection.query(quer,function(err,rows,fields){
			if(err){
				socket.emit('getFavoritesError',err.code);
				console.log('error retrieving favorites: '+err.code);
				console.log('query: '+quer);
				return false;
			}
			else{
				socket.emit('favorites',rows);
				return true;
			}
		});
	});

	//-handle favorites update
	socket.on('favoritesUpdate',function(packet){
		var pt=testPacketUserToken(packet);
		if(pt.error){
			socket.emit('favoritesUpdateError',pt.code);
			return false;
		}
		console.log('updating favorites for user: '+packet.user.id);
		console.log(JSON.stringify(packet.f));
		var googid=connection.escape(packet.user.id);
		var quer='DELETE FROM `favorites` WHERE `google_id` = '+googid+';';
		connection.query(quer,function(err,results){
			if(err){
				socket.emit('favoritesUpdateError',err.code);
				console.log('error removing favorites: '+err.code);
				console.log('query: '+quer);
				return false;
			}
			else{
				if(!packet.f.length){
					socket.emit('favoritesUpdateSuccess');
					return true;
				}
				var now=Math.floor(Date.now() / 1000),
				run=packet.f.length,
				i=0,
				ytid;
				quer='INSERT INTO `favorites` (`google_id`,`youtubeId`,`img`,`title`,`description`,`date_created`) VALUES ';
				for(;i<run;i++){
					ytid=connection.escape(packet.f[i].youtubeId);
					img=connection.escape(packet.f[i].img);
					tit=connection.escape(packet.f[i].title);
					desc=connection.escape(packet.f[i].description);
					quer+='('+googid+','+ytid+','+img+','+tit+','+desc+','+now+') ';
				}
				quer+=';';
				connection.query(quer,function(err,results){
					if(err){
						socket.emit('favoritesUpdateError',err.code);
						console.log('error adding favorites: '+err.code);
						console.log('query: '+quer);
						return false;
					}
					else{
						socket.emit('favoritesUpdateSuccess');
						return true;
					}
				});
			}
		});
	});

	//-handle when someone edits a track
	socket.on('trackUpdate',function(packet){
		console.log('track update received:');
		console.log(JSON.stringify(packet));

		var pt=testPacketUserToken(packet);
		if(pt.error){
			socket.emit('trackUpdateError',pt.code);
			return false;
		}

		var t=packet.t;
		var st=connection.escape(t.title),
		sa=connection.escape(t.artist),
		stag=connection.escape(t.tags),
		stid=connection.escape(t.trackId),
		now=Math.floor(Date.now() / 1000);
		goddamnquery='UPDATE `tracks` SET `title` = '+st+', `artist` = '+sa+', `tags` = '+stag+', `date_modified` = '+now+' WHERE `trackId` = '+stid+' LIMIT 1;';
		connection.query(goddamnquery,
			function(err,results){
				if(err){
					socket.emit('trackUpdateError',err.code);
					console.log('error updating track: '+err.code);
					console.log('query:');
					console.log(goddamnquery);
				}
				else{
					t.trackId=t.trackId;
					socket.emit('trackUpdateSuccess');
					io.emit('trackUpdate',t);
				}
			}
		);
	});

	//-handle delete track request
	socket.on('trackDelete',function(packet){
		console.log('REQUEST (delete track) packet:');
		console.log(JSON.stringify(packet));

		var pt=testPacketUserToken(packet);
		if(pt.error){
			socket.emit('trackDeleteError',pt.code);
			return false;
		}

		var dtid=connection.escape(packet.trackId);
		quer='DELETE FROM `tracks` WHERE `trackId` = '+dtid+' LIMIT 1;';
		connection.query(quer,function(err,results){
			if(err){
				socket.emit('trackDeleteError',err.code);
				console.log('error updating track: '+err.code);
				console.log('query:');
				console.log(quer);
			}
			else{
				console.log('DELETE (track:'+packet.trackId+')');
				socket.emit('trackDeleteSuccess');
				io.emit('trackDelete',{trackId:packet.trackId});
				//-check queue
				var run=q.length,
				i=0,
				u=false;
				for(;i<q;i++){
					if(q[i].trackId===packet.trackId){
						q.splice(i,1);
						u=true;
					}
				}
				if(u===true){
					io.emit('queueUpdate',q);
				}
			}
		});
	});
});

var server_port = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || 8080;
var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';

http.listen(server_port, server_ip_address, function(){
  console.log('listening');
});

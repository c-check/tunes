window.tunes = {

	DIR_TRACKS:'http://tunes.curtishiller.com/t/',
	TOP_SECTION_HEIGHT:320,

	USER:{},

	resizeTO:null,

	slideVolume:.8,
	volume:.8,

	currentM:0,
	currentMTimer:null,
	trackTimer:null,
	yt:null,
	ytTimer:null,
	ytDuration:0,

	handleAPIFailure:function(){
		console.log('AJAX/API failure.');
	},
	setVolume:function(v){
		if(window.tunes.yt!==null){
			window.tunes.yt.setVolume(100*v);
		}
		else{
			$('#mp3Player').prop('volume',v);
		}
		window.tunes.volume=v;
		return true;
	},
	initVolume:function(){
		var l=6,r=78,o=32,
		v;
		$('.volume a').draggable({
			axis:'x',
			containment:[l+o,10,r+o,10],
			drag:function(e,ui){
				$('.mute').removeClass('active');
				v=(ui.position.left-l)/(r-l);
				console.log('vol drag: '+ui.position.left);
				window.tunes.slideVolume=v;
				window.tunes.setVolume(v);
			}
		});
		$('body').on('click','.mute',function(){
			$(this).toggleClass('active');
			window.tunes.setVolume($(this).hasClass('active')?0:window.tunes.slideVolume);
		})
	},
	emptyTrack:function(){
		$('.track audio').remove();
		$('.track').empty();
		$('.np span').empty();
		$('.np .who').html('&hellip;');
		window.tunes.currentM=0;
		clearInterval(window.tunes.currentMTimer);
		clearInterval(window.tunes.trackTimer);
		window.tunes.currentMTimer=window.tunes.trackTimer=null;
		window.tunes.yt=null;
		clearInterval(window.tunes.ytTimer);
		window.tunes.ytTimer=null;
		window.tunes.ytDuration=0;
		$('.yttime').empty();
		return true;
	},
	handleTrackEnd:function(){
		var send={
			user:window.tunes.USER,
			trackToken:$('.track').attr('token')
		};
		window.tunes.socket.emit('trackEnd',send);
		window.tunes.emptyTrack();
		console.log('track ended.');
		return true;
	},
	setupYTTimer:function(){
		console.log('setting up yt timer');
		window.tunes.ytTimer=setInterval(function(){
			if(window.tunes.ytDuration===0){
				var temp=window.tunes.yt.getDuration();
				console.log('yt duration: '+temp);
				if(temp!==0){
					$('.yttime').append('<span></span>&nbsp;/&nbsp;'+window.tunes.convertSecondsToMinutes(temp));
					window.tunes.ytDuration=temp;
				}
			}
			$('.yttime span').html(window.tunes.convertSecondsToMinutes(window.tunes.yt.getCurrentTime()));
		},1000);
	},
	handleYoutubePlayerStateChange:function(e){
		console.log('yt state change');
		console.log(e.data);
		if(e.data===YT.PlayerState.ENDED){
			window.tunes.handleTrackEnd();
			return true;
		}
		if(e.data===YT.PlayerState.PLAYING){
			if(window.tunes.ytTimer===null){
				window.tunes.setupYTTimer();
			}
			return true;
		}
	},
	convertSecondsToMinutes:function(s){
		var d=new Date( s*1000 );
		var mm=d.getUTCMinutes(),
		ss=d.getUTCSeconds();
		if(ss<10){
			ss='0'+ss;
		}
		return mm+':'+ss;
	},
	fetchFilePlayerArtwork:function(t){
		var term='',sep='';
		if(t.artist){
			term+=t.artist;
			sep=' ';
		}
		if(t.title){
			term+=sep+t.title;
		}
		if(term==''){
			return false;
		}
		$.ajax({
			url:'https://itunes.apple.com/search',
			data:{
				term:term,
				country:'US',
				media:'music',
				limit:1,
				explicit:'yes'
			},
			jsonpCallback:'callback',
			dataType:'JSONP',
			success:function(res){
				console.log('artwork success:');
				console.log(res);
				if(res.resultCount>0&&res.results[0].artworkUrl100){
					$('.track .artwork').attr('src',res.results[0].artworkUrl100);
					$('.file-bg').css('background-image','url('+res.results[0].artworkUrl100+')');
					return true;
				}
				return false;
			}
		});
		return true;
	},
	setupTrackTimer:function(dm){
		window.tunes.trackTimer=setInterval(function(){
			$('.track .timer span').eq(0).html(window.tunes.convertSecondsToMinutes(dm.currentTime));
		},1000);
		return true;
	},
	playFile:function(t){
		$('.track').replaceWith(window.tunes.view.buildFilePlayer(t));
		var dm=document.getElementById('mp3Player');
		dm.volume=window.tunes.volume;
		dm.load();
		dm.onloadedmetadata=function(){
			$('.track .timer span').eq(1).html(window.tunes.convertSecondsToMinutes(dm.duration));
		};
		$(dm).on('ended',window.tunes.handleTrackEnd);
		if(t.m>0){
			console.log('seeking to '+t.m);
			window.tunes.currentM=t.m;
			dm.oncanplaythrough = function(){
				clearInterval(window.tunes.currentMTimer);
				window.tunes.currentMTimer=null;
				dm.currentTime=window.tunes.currentM;
				dm.play();
				window.tunes.setupTrackTimer(dm);
				window.tunes.currentM=0;
				dm.oncanplaythrough=null;
			}
			window.tunes.currentMTimer=setInterval(500,function(){window.tunes.currentM+=.5;});
		}
		else{
			dm.play();
			window.tunes.setupTrackTimer(dm);
		}
		window.tunes.fetchFilePlayerArtwork(t);
		return true;
	},
	playYoutube:function(t){
		var h2h=$('h2.np').outerHeight();
		$('.track').append(
			$(document.createElement('div')).attr('id','tyt').css('margin-top',h2h)
		);
		window.tunes.yt = new YT.Player('tyt',{
			height:window.tunes.TOP_SECTION_HEIGHT-h2h,
			width:'100%',
			videoId:t.youtubeId,
			playerVars:{
				controls:0,
				loop:0,
				modestbranding:1,
				rel:0,
				showinfo:0,
				theme:'dark',
				start:t.m
			},
			events:{
				'onStateChange':window.tunes.handleYoutubePlayerStateChange,
				'onReady':function(e){
					e.target.setVolume(window.tunes.volume*100);
					e.target.playVideo();
				}
			}
        });
        return true;
	},
	playTrack:function(t){
		window.tunes.emptyTrack();
		if($.isEmptyObject(t)){
			return false;
		}
		console.log('playing...');
		console.log(t);
		$('.np .who').html(t.djname);
		if(t.type==='file'){
			window.tunes.playFile(t);
		}
		if(t.type==='youtube'){
			window.tunes.playYoutube(t);
		}
		$('.track').attr({
			trackId:t.trackId,
			youtubeId:t.youtubeId,
			token:t.token
		});
	},
	
	handleUploadError:function(res){
		$('.uerror').empty();
		var eh='';
		if(res.error){
			eh=res.error;
		}
		if(res.files){
			$(res.files).each(function(){
				if(this.error){
					eh+='<br />('+this.track+') '+this.error;
				}
			});
		}
		$('.uerror').html(eh).on('click',function(){$(this).remove();});
	},
	addFileToTop:function(f){
		console.log('adding recent file:'+f);
		$('.files-yours tbody').prepend(window.tunes.view.buildFileRow(f,'yours'));
	},
	handleUploadedFiles:function(res){
		if(res.error!==''||!res.files){
			console.log('error with response');
			console.log(res);
			window.tunes.handleUploadError(res);
			return false;
		}
		$(res.files).each(function(){
			if(this.error===''){
				window.tunes.addFileToTop(this);
				window.tunes.socket.emit('fileUploaded',this);
			}
			else{
				console.log('Skipping file due to error: '+this.error);
				window.tunes.handleUploadError(res);
			}
		});
		return true;
	},
	displayLoadingBar:function(){
		$('.loading').show();
	},
	hideLoadingBar:function(){
		$('.loading').hide();
	},
	updateLoadingBar:function(percent){
		$('.loading .bar').css('width',percent+'%');
	},
	initFileUpload:function(){
		$('.panel.yours').fileupload({
			url:'http://tunes.curtishiller.com/upload',
			paramName:'files',
			formData:window.tunes.USER,
	        add: function (e, data) {
	        	console.log('added');
	        	console.log(e);
	        	console.log(data);
	        	window.tunes.displayLoadingBar();
		        data.submit()
		            .success(function (result, textStatus, jqXHR) {
		            	var j;
		            	try{
		            		j=$.parseJSON(result);
		            	}catch(e){
		            		console.log(result);
		            		j={};
		            	}
		            	console.log(j);
		            	window.tunes.handleUploadedFiles(j);
		            })
		            .error(function (jqXHR, textStatus, errorThrown) {
		            	console.log('error');
		            	console.log(textStatus);
		            	console.log(errorThrown);
		            });
		    },
	        progressall: function (e, data) {
		        var progress = parseInt(data.loaded / data.total * 100, 10);
	        	window.tunes.updateLoadingBar(progress);
		        console.log('upload progess: '+progress);
		    },
		    done:function(e,data){
		    	console.log('done uploading.');
		    	window.tunes.hideLoadingBar();
		    }
	    });
	},
	clearFileFilter:function(){
		$('.filter').val('');
		return true;
	},
	findSubstr:function(needle,haystack){
		return haystack.toLowerCase().indexOf(needle.toLowerCase()) >= 0;
	},
	handleFilterInput:function(e){
		var filters=[];
		if(e===undefined){
			filters=$('.filter');
		}
		else{
			filters.push(e.currentTarget);
		}
		$(filters).each(function(){
			var panel=$(this).parents('.panel');
			var needle=$(panel).find('.filter').val(),
			g=$(panel).find('.search .group').val(),
			target=$(panel).find('.files'),
			h,t;
			if(needle===''){
				$(target).find('.t').show();
				return true;
			}
			$(target).find('.t').each(function(){
				h=$(this);
				if(
					((g==='all'||g==='title')&&window.tunes.findSubstr(needle,h.find('.title').html())) || 
					((g==='all'||g==='artist')&&window.tunes.findSubstr(needle,h.find('.artist').html())) || 
					((g==='all'||g==='tags')&&window.tunes.findSubstr(needle,h.find('.tags').html())) 
				){
					h.show();
				}
				else{
					h.hide();
				}
			});
		});
		return true;
	},
	initFilters:function(){
		$('body').on('keyup','.filter',window.tunes.handleFilterInput);
		$('body').on('change','.search .group',window.tunes.handleFilterInput);
	},
	handleQueueRemoveClick:function(){
		$(this).parents('tr').remove();
		window.tunes.sendQueueUpdate();
		return true;
	},
	stopAllEvents:function(){
		$(window).on('click',function(e){
			e.stopPropagation();
		});
		return true;
	},
	resumeAllEvents:function(){
		$(window).off();
	},
	handleTrackUpdateSuccess:function(){
		//$('.edit .msg').empty().html('Track successfully updated.');
	},
	clearEditMessage:function(){
		$('.edit .msg').empty();
	},
	displayFileEdit:function(){
		var o=window.tunes.getFileObjectFromRow($(this).parents('tr')),
		iv,temp;
		$('.edit-file-form input[type="text"]').each(function(){
			iv=o[$(this).attr('name')];
			$(this).val(iv);
			$(this).attr('init',iv)
		});
		$('.edit input[name="trackId"]').val(o.trackId);
		$('.edit .file').html(o.file);
		window.tunes.view.showModal(window.tunes.view.FILE_EDIT_MODAL_ID);
	},
	handleFileEditSave:function(e){
		e.preventDefault();
		var save=false,
		t={},
		send={
			user:window.tunes.USER
		},
		v;
		$('.edit-file-form input').each(function(){
			if($(this).attr('type')!=='submit'){
				v=$(this).val();
				t[$(this).attr('name')]=v;
				if(v!==$(this).attr('init')){
					save=true;
				}
			}
		});
		if(!save){
			return false;
		}
		send.t=t;
		console.log('sending track update:');
		console.log(send);
		window.tunes.socket.emit('trackUpdate',send);
		window.tunes.view.closeModal();
		return false;
	},
	confirmDeleteTrack:function(){
		if(confirm('Are you sure, chumpchange?')){
			var send={
				user:window.tunes.USER,
				trackId:$('.edit-file-form input[name="trackId"]').val()
			};
			console.log('sending delete track:');
			console.log(send);
			window.tunes.socket.emit('trackDelete',send);
			window.tunes.view.closeModal();
		}
		return true;
	},
	initFileEditing:function(){
		$('.edit-file-form').on('submit',window.tunes.handleFileEditSave);
		$('.edit').on('click','.delete_track',window.tunes.confirmDeleteTrack);
	},
	handleTrackDelete:function(o){
		console.log('received track delete:');
		console.log(o);
		$('.t[trackId="'+o.trackId+'"]').remove();
		return true;
	},
	handleTrackUpdate:function(t){
		console.log('received track update:');
		console.log(t);
		$('.b2 .t[trackId="'+t.trackId+'"]').replaceWith(window.tunes.view.buildFileRow(t,'yours'));
		return true;
	},
	clearYTSearchResults:function(){
		$('.youtubes-search-results').off();
		$('.youtubes-search-results tbody').empty();
	},
	handleYTSearchResponse:function(j){
		console.log('youtube search returned '+j.items.length+' results.');
		if(j.items.length>0){
			var n;
			$(j.items).each(function(){
				n={
					youtubeId:this.id.videoId,
					img:this.snippet.thumbnails.default.url,
					title:this.snippet.title,
					description:this.snippet.description,
					djid:window.tunes.USER.id,
					djname:window.tunes.USER.nickname
				};
				$('.youtubes-search-results tbody').append(window.tunes.view.buildYTRow(n,'search'));
			});
			window.tunes.updateCSS();
		}
	},
	handleYTSearch:function(e){
		e.preventDefault();
		window.tunes.clearYTSearchResults();
		var yts=$(e.currentTarget).find('.yts').val();
		$('.yts').val(yts);
		console.log('youtube search for: '+yts);
		if(yts===''){
			return false;
		}
		window.tunes.clearYTSearchResults();
		var request = gapi.client.youtube.search.list({
			q:yts,
			part:'snippet',
			type:'video',
			order:'relevance',
			maxResults:20,
			safeSearch:'none',
			videoEmbeddable:'true'
		});
		request.execute(window.tunes.handleYTSearchResponse);
		window.tunes.view.showModal(window.tunes.view.YOUTUBE_MODAL_ID);
	},
	removeYT:function(){
		$(this).parents('tr').remove();
		window.tunes.sendFavoritesUpdate();
	},
	saveYT:function(){
		var tr=$(this).parents('tr');
		var o=window.tunes.getYTObjectFromRow(tr);
		console.log('favoriting yt:');
		console.log(o);
		if( $('.youtubes-saved tbody tr[youtubeId="'+o.youtubeId+'"]').length ){
			return false;
		}
		$('.youtubes-saved tbody').append(window.tunes.view.buildYTRow(o,'favorites'));
		window.tunes.sendFavoritesUpdate();
	},
	initYTSearch:function(){
		$('.youtube-search-form').on('submit',window.tunes.handleYTSearch);
		$('body').on('.youtubes-search-results .add','click',window.tunes.addYTSearchResultToQueue);
	},
	getFileObjectFromRow:function(fr){
		return {
			trackId:$(fr).attr('trackId'),
			filetype:$(fr).attr('filetype'),
			file:$(fr).attr('file'),
			artist:$(fr).find('.artist').text(),
			title:$(fr).find('.title').text(),
			tags:$(fr).find('.tags').text(),
			djname:$(fr).find('.dj').text(),
			djid:$(fr).find('.dj').attr('djid')
		};
	},
	getYTObjectFromRow:function(ytr){
		return {
			youtubeId:$(ytr).attr('youtubeId'),
			img:$(ytr).find('img').length?$(ytr).find('img').attr('src'):'',
			title:$(ytr).find('.yt-title').text(),
			description:$(ytr).find('.yt-desc').text(),
			djid:$(ytr).find('.dj').attr('djid'),
			djname:$(ytr).find('.dj').text()
		};
	},
	addRowToQueue:function(){
		var t=$(this).parents('tr');
		var r=t.hasClass('yt')?window.tunes.getYTObjectFromRow(t):window.tunes.getFileObjectFromRow(t);
		r.djname=window.tunes.USER.nickname;
		r.djid=window.tunes.USER.id;
		console.log('adding row to queue:');
		console.log(r);
		$('.q tbody').append(t.hasClass('yt')?
			window.tunes.view.buildYTRow(r,'queue'):
			window.tunes.view.buildFileRow(r,'queue')
		);
		window.tunes.sendQueueUpdate();
		window.tunes.updateQueueSetup();
		window.tunes.updateCSS();
		return true;
	},
	handleSortClick:function(){
		//-TO DO
		return false;
	},
	initSorting:function(){
		$('body').on('.sorter','click',window.tunes.handleSortClick);
	},
	handlePanelClick:function(){
		var wrap=$(this).parents('.panel-wrapper');
		var cont=wrap.find('.panel-container');
		cont.children().removeClass('active');
		cont.children().eq($(this).index()).addClass('active');
		wrap.find('h3.button').removeClass('active');
		$(this).addClass('active');
		window.tunes.updateCSS();
		//-handle activate/deactive upload
		if($(this).hasClass('yours')){
			$('.panel.yours').fileupload('enable');
		}
		else{
			$('.panel.yours').fileupload('disable');
		}
		return true;
	},
	initUtil:function(){
		$('.queue').on('click','.remove',window.tunes.handleQueueRemoveClick);
		$('.files').on('click','.edit',window.tunes.displayFileEdit);
		$('body').on('click','.add',window.tunes.addRowToQueue);
		$('body').on('click','.save',window.tunes.saveYT);
		$('.youtubes-saved').on('click','.remove',window.tunes.removeYT);
	},
	initPanels:function(){
		$('body').on('click','h3.button',window.tunes.handlePanelClick);
	},
	initSkip:function(){
		$('body').on('click','.skip',window.tunes.handleTrackEnd);
	},
	sendFavoritesUpdate:function(){
		var send={
			user:window.tunes.USER,
			f:[]
		}
		$('.youtubes-saved tr').each(function(){
			send.f.push(window.tunes.getYTObjectFromRow(this));
		});
		console.log('sending favorites update:');
		console.log(send);
		window.tunes.socket.emit('favoritesUpdate',send);
	},
	initQueueSort:function(){
		$('.q tbody').sortable({
			axis:'y',
			containment:'.panel.queue',
			cursor:'move',
			forcePlaceholderSize:true,
			helper:function(e,tr){
				var stuff=$(tr).html();
				return $(tr).empty().append(
					$(document.createElement('div')).addClass('ui-sort-row').html(stuff)
				);
			},
			stop:function(e,ui){
				var i=$(ui.item[0]);
				var stuff=i.find('.ui-sort-row').html();
				$(i).empty().append(stuff);
			},
			update:window.tunes.sendQueueUpdate
		});
	},
	updateQueueSetup:function(){
		if($('.q tr:not(.noqueue)').length){
			$('.q .noqueue').hide();
		}
		else{
			$('.q .noqueue').show();
		}
	},
	sendQueueUpdate:function(){
		var send={
			user:window.tunes.USER,
			q:[]
		},
		rows=$('.q tr:not(.noqueue)'),
		r;
		rows.each(function(){
			if($(this).attr('youtubeId')){
				r=window.tunes.getYTObjectFromRow(this);
				r.type='youtube';
				send.q.push(r);
			}
			else{
				r=window.tunes.getFileObjectFromRow(this);
				r.type='file';
				send.q.push(r);
			}
		});
		console.log('sending updated queue:');
		console.log(send);
		window.tunes.socket.emit('queueUpdate',send);
	},
	emptyRecent:function(){
		$('.recently_played tbody').empty();
	},
	emptyAllFiles:function(){
		$('.files tbody').empty();
	},
	emptyQueue:function(){
		$('.q tbody').empty();
	},
	emptyFavorites:function(){
		$('.youtubes-saved tbody').empty();
	},
	emptyPeeps:function(){
		$('.users tbody').empty();
	},
	buildPeeps:function(p){
		console.log('received new peeps:');
		console.log(p);
		window.tunes.emptyPeeps();
		$(p).each(function(){
			$('.users tbody').append(window.tunes.view.buildPeepsRow(this));
		});
		window.tunes.updateCSS();
	},
	buildFavorites:function(nf){
		window.tunes.emptyFavorites();
		console.log('received new favorites:');
		console.log(nf);
		$(nf).each(function(){
			$('.youtubes-saved tbody').append(window.tunes.view.buildYTRow(this,'favorites'));
		});
		window.tunes.updateCSS();
	},
	buildRecent:function(nr){
		window.tunes.emptyRecent();
		console.log('received new recent:');
		console.log(nr);
		$(nr).each(function(){
			switch(this.type){
				case 'file':
					$('.rec tbody').append(window.tunes.view.buildFileRow(this,'recent'));
				break;
				case 'youtube':
					$('.rec tbody').append(window.tunes.view.buildYTRow(this,'recent'));
				break;
				default:break;
			};
		});
		window.tunes.updateCSS();
	},
	buildAllFiles:function(nf){
		window.tunes.emptyAllFiles();
		console.log('received new files:');
		console.log(nf);
		$(nf).each(function(){
			if(this.uploadedBy===window.tunes.USER.id){
				$('.files-yours tbody').append(window.tunes.view.buildFileRow(this,'yours'));
			}
			else{
				$('.files-other tbody').append(window.tunes.view.buildFileRow(this,'others'));
			}
		});
		window.tunes.clearFileFilter();
		window.tunes.updateCSS();
	},
	buildQueue:function(nq){
		window.tunes.emptyQueue();
		console.log('received new queue:');
		console.log(nq);
		$(nq).each(function(){
			switch(this.type){
				case 'file':
					$('.q tbody').append(window.tunes.view.buildFileRow(this,'queue'));
				break;
				case 'youtube':
					$('.q tbody').append(window.tunes.view.buildYTRow(this,'queue'));
				break;
				default:break;
			};
		});
		window.tunes.updateCSS();
		window.tunes.updateQueueSetup();
	},
	initSocket:function(){
		window.tunes.socket=io.connect('http://tunes-papashango.rhcloud.com:8000/');
		window.tunes.socket.on('track',window.tunes.playTrack);
		window.tunes.socket.on('queue',window.tunes.buildQueue);
		window.tunes.socket.on('allFiles',window.tunes.buildAllFiles);
		window.tunes.socket.on('trackUpdate',window.tunes.handleTrackUpdate);
		window.tunes.socket.on('trackDelete',window.tunes.handleTrackDelete);
		window.tunes.socket.on('recent',window.tunes.buildRecent);
		window.tunes.socket.on('favorites',window.tunes.buildFavorites);
		window.tunes.socket.on('peeps',window.tunes.buildPeeps);
		window.tunes.socket.emit('init',{user:window.tunes.USER});
		window.tunes.socket.emit('getAllFiles',{user:window.tunes.USER});
		window.tunes.socket.emit('getFavorites',{user:window.tunes.USER});
	},
	updateCSSOnResize:function(){
		clearTimeout(window.tunes.resizeTO);
		window.tunes.resizeTO=setTimeout(window.tunes.updateCSS,75);
		return true;
	},
	updateCSS:function(){
		//-yscrolling panels
		var adj;
		$('.panel.active .panel-yscroll, .modal .panel-yscroll').each(function(){
			adj=$(this).parent().innerHeight();
			$(this).css('max-height',adj-$(this).parent().find('.panel-header').height()-13);
		});
		//-thead width
		$('.thead').each(function(){
			adj=$(this).parents('.panel').find('.panel-body table').width();
			$(this).width(adj);
		});
		//-top section
		$('.r1').height(window.tunes.TOP_SECTION_HEIGHT);
		$('.r2').height($(window).height()-window.tunes.TOP_SECTION_HEIGHT);
		return true;
	},
	initCSS:function(){
		window.tunes.updateCSS();
		$(window).on('resize',window.tunes.updateCSSOnResize);
		return true;
	},
	initApp:function(){
		window.tunes.initCSS();
		window.tunes.initFileUpload();
		window.tunes.initPanels();
		window.tunes.initFilters();
		window.tunes.initYTSearch();
		window.tunes.initUtil();
		window.tunes.initQueueSort();
		window.tunes.initSorting();
		window.tunes.initFileEditing();
		window.tunes.initSkip();
		window.tunes.initVolume();
		window.tunes.view.initModal();
	},
	handleYTSearchReady:function(){
		//-to do
	}
};
$(document).ready(function(){
	window.tunes.initSocket();
	window.tunes.initApp();
});
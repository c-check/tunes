window.tunes.view={

	YOUTUBE_MODAL_ID:0,
	FILE_EDIT_MODAL_ID:1,

	DEFAULT_TRACK_ARTWORK_SRC:'/styles/img/default.jpg',

	buildYTRow:function(yt,dest){
		/*
			<tr class="yt">
				<td class="artsong">
					<div class="yt-thumb">
						<img src="{{ r.snippet.thumbnails.default.url }}" />
					</div>
					<div class="yt-meta">
						<div class="yt-title">{{ r.snippet.title }}</div>
						<div class="yt-desc">{{ r.snippet.description }}</div>
					</div>
				</td>
				<td class="util add">
					<a></a>
				</td>
				<td class="til save">
					<a></a>
				</td>
				<td class="util remove">
					<a></a>
				</td>
			</tr>
		*/
		var td,
		ytr=$(document.createElement('tr'))
			.attr({
				youtubeId:yt.youtubeId,
				class:'yt'
			})
			.append($(document.createElement('td')).addClass('artsong')
				.append(
					$(document.createElement('div')).addClass('yt-thumb')
				)
				.append(
					$(document.createElement('div')).addClass('yt-meta')
						.append($(document.createElement('div')).addClass('yt-title').html(yt.title))
						.append($(document.createElement('div')).addClass('yt-desc').html(yt.description))
				)
			);
		if( yt.img ){
			ytr.find('.yt-thumb').append($(document.createElement('img')).attr('src',yt.img));
		}

		if(dest==='queue'||dest==='recent'){
			ytr.append(
				$(document.createElement('td')).attr({
					class:'dj',
					djid:yt.djid?yt.djid:window.tunes.USER.id
				})
					.html(yt.djname?yt.djname:window.tunes.USER.nickname)
			)
		}

		//-add (play) button
		if(dest!=='queue'){
			ytr.append($(document.createElement('td')).addClass('util add')
				.append('<a></a>')
			);
		}

		//-save (favorite) button
		if(dest!=='favorites'){
			//-TODO - test if already favorited
			ytr.append($(document.createElement('td')).addClass('util save')
				.append('<a></a>')
			);
		}

		//-remove button
		if(dest==='queue'||dest==='favorites'){
			ytr.append($(document.createElement('td')).addClass('util remove')
				.append('<a></a>')
			);
		}

		return ytr;
	},

	buildFileRow:function(f,dest){
		/*

			<tr class="t" djid="" trackId="">
				<td class="artsong">
					<div class="artist">{{ f.artist }}</div>
					<div class="title">{{ f.title }}</div>
				</td>
				<td class="tags">{{ f.tags }}</td>
				<td class="add util">
					<a ng-click="addFileToQueue(f)"></a>
				</td>
				<td class="edit util">
					<a ng-click="editFile(f)"></a>
				</td>
			</tr>
		*/
		var fr=$(document.createElement('tr'))
			.attr({
				trackId:f.trackId?f.trackId:f.trackId,
				filetype:f.filetype,
				file:f.file,
				class:'t'
			})
			.append(
				$(document.createElement('td')).addClass('artsong')
					.append($(document.createElement('div')).addClass('artist').html(f.artist))
					.append($(document.createElement('div')).addClass('title').html(f.title))
			);

		//-tags or dj
		if(dest==='yours'||dest==='others'){
			fr.append(
				$(document.createElement('td')).addClass('tags').html(f.tags)
			);
		}
		else{
			fr.append(
				$(document.createElement('td')).attr({
					class:'dj',
					djid:f.djid?f.djid:window.tunes.USER.id
				})
				.html(f.djname?f.djname:window.tunes.USER.nickname)
			);
		}

		//-add (play)
		if(dest!=='queue'){
			fr.append(
				$(document.createElement('td')).addClass('add util')
					.append($(document.createElement('a')))
			);
		}
		//-save (favorite) (non-functional)
		if(dest==='queue'||dest==='recent'){
			fr.append($(document.createElement('td')).addClass('util'));
		}
		//-remove
		if(dest==='queue'){
			fr.append(
				$(document.createElement('td')).addClass('remove util')
					.append($(document.createElement('a')))
			);
		}
		//-edit
		if(dest==='yours'||dest==='others'){
			fr.append(
				$(document.createElement('td')).addClass('edit util')
					.append($(document.createElement('a')))
			);
		}

		return fr;
	},

	buildPeepsRow:function(p){
		var ret='';
		$(p).each(function(){
			ret+='<tr><td>'+p.nickname+'</td></tr>';
		});
		return ret;
	},

	buildFilePlayer:function(t){
		/*
		<div class="file-bg" ng-if="trackHasArtwork()" ng-style="{ 'background-image' : 'url({{ getTrackArtwork() }})' }"></div>
		<div class="file-wrapper">
			<audio id="mp3Player">
				<source src="{{ TRACK.file }}" type="audio/{{ TRACK.filetype }}" token="{{ TRACK.token }}" />
			</audio>
			<img class="artwork" ng-src="{{ getTrackArtwork() }}" src="/styles/img/default.jpg" />
			<div class="tt-wrapper">
				<h3 ng-class="{hasimg : trackHasArtwork}">{{ TRACK.artist }}</h3>
				<h1>{{ TRACK.title }}</h1>
			</div>
			<div class="timer" ng-if="trackHasDuration()">
				<span>{{ trackCurrentTime }}</span> / <span>{{ trackDuration }}</span>
			</div>
		</div>
		*/
		return $(document.createElement('div')).addClass('track')
			.append($(document.createElement('div')).addClass('file-bg'))
			.append($(document.createElement('div')).addClass('file-wrapper')
				.append($(document.createElement('audio')).attr('id','mp3Player')
					.append($(document.createElement('source')).attr({
							src:window.tunes.DIR_TRACKS+t.file,
							type:"audio/"+t.filetype,
							token:t.token
						})
					)
				)
				.append($(document.createElement('img')).attr({
						class:'artwork',
						src:window.tunes.view.DEFAULT_TRACK_ARTWORK_SRC
					})
				)
				.append($(document.createElement('div')).addClass('tt-wrapper')
					.append($(document.createElement('h3')).html(t.artist))
					.append($(document.createElement('h1')).html(t.title))
				)
				.append($(document.createElement('div')).addClass('timer').html('<span></span> / <span></span>'))
			);
	},
	
	showModal:function(id){
		$('.modal .panel-wrapper').hide();
		$('.modal .panel-wrapper').eq(id).show();
		$('.modal').show();
		window.tunes.updateCSS();
		return true;
	},
	closeModal:function(){
		$('.modal').hide();
		window.tunes.updateCSS();
	},
	initModal:function(){
		$('.modal').on('click','.m-close',window.tunes.view.closeModal);
	}
};
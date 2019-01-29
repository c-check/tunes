
var bapikey = 'AIzaSyCHcaDs_1Uf_6NiX2Y3cQZtW0VW6arPOU0';
var scopes = 'https://www.googleapis.com/auth/youtube';

function handleGoogleClientLoad() {
  gapi.client.setApiKey(bapikey);
  gapi.client.load('youtube','v3',function(){
    window.tunes.handleYTSearchReady();
  });
}
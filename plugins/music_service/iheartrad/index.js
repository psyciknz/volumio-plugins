'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var iHeart = require('iheart');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;


module.exports = iheartrad;
function iheartrad(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

}



iheartrad.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

    return libQ.resolve();
}

iheartrad.prototype.onStart = function() {
	var self = this;
	var defer=libQ.defer();

	self.commandRouter.logger.info('iheartrad: starting');

	self.addToBrowseSources();

	
	// Once the Plugin has successfull started resolve the promise
	self.commandRouter.logger.info('iheartrad: end of start');

	defer.resolve();

    return defer.promise;
};

iheartrad.prototype.onStop = function() {
	var self = this;
	var defer=libQ.defer();

	self.removeFromBrowseSources();
	// Once the Plugin has successfull stopped resolve the promise
	defer.resolve();

	return libQ.resolve();
};

iheartrad.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

iheartrad.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf) {
	     uiconf.sections[0].content[0].value = self.config.get('experimental', false);
            defer.resolve(uiconf);
        })
        .fail(function() { 
            defer.reject(new Error());
        });

    return defer.promise;
};

iheartrad.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

iheartrad.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

iheartrad.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

iheartrad.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};



// Playback Controls ---------------------------------------------------------------------------------------
// If your plugin is not a music_sevice don't use this part and delete it


iheartrad.prototype.addToBrowseSources = function () {

	var self=this;
	// Use this function to add your music service plugin to music sources
	self.commandRouter.logger.info('iheartrad.addTobrowseSources');
	var data = {
		name: 'iHeartRadio', 
		uri: '/iheartrad',
		plugin_type:'music_service',
		plugin_name:'iheartrad',
		icon: 'fa fa-microphone',
		albumart: '/albumart?sourceicon=music_service/iheartrad/iheart.svg'

	};
	this.commandRouter.volumioAddToBrowseSources(data);
};

iheartrad.prototype.removeFromBrowseSources = function () {
	// Use this function to add your music service plugin to music sources
	var self = this;

	self.commandRouter.volumioRemoveToBrowseSources('iheartrad');
};

iheartrad.prototype.handleBrowseUri = function (curUri) {
	var self = this;

	self.commandRouter.logger.info('iheartrad.handleBrowseUri: ' + curUri);
	console.log('handleBrowseUri: '+curUri);
	var response = [];
	var defer = libQ.defer();

	var response = {
        navigation: {
            prev: {
                uri: "/iheartrad"
            }, //prev
            lists: [{
                "availableListViews": ["list","grid"],
                "items": []
            }] //lists
        } //navigation
    }; //var response

    var list = response.navigation.lists[0].items;

    if (curUri.startsWith('/iheartrad')) {
		self.commandRouter.logger.info('iheartrad: found an iheart url: ' + curUri);
		if (curUri === '/iheartrad') {
			self.commandRouter.logger.info('iheartrad: Default url: ' + curUri);
			
			list.push({
				service: 'iheartrad',
				type: 'folder',
				title: 'Saved',
				artist: '',
				album: '',
				icon: 'fa fa-folder-open-o',
				url: '/iheartrad/saved'
			});

			list.push({
				service: 'iheartrad',
				type: 'folder',
				title: 'Browse',
				artist: '',
				album: '',
				icon: 'fa fa-folder-open-o',
				url: '/iheartrad/browse'
			});
			self.commandRouter.logger.info('iheartrad: Default url: after getRootContent');
			self.commandRouter.logger.info('iheartrad: list:' + JSON.stringify(list));
		} //if (curUri === 'iheartrad')
		else if (curUri.startsWith('iheartrad/saved')) {
			self.commandRouter.logger.info('iheartrad: Try and search for ZM station id');
			var matches = iHeart.getById('zm-6190');
			if (matches.length > 0) {
				self.commandRouter.logger.info(`iheartrad: matches: ${JSON.stringify(matches)}`);
				const station = matches.stations[0];
				const surl = iHeart.streamURL(station);

				list.push({
					service: 'webradio',
					type: 'station',
					title: 'ZM',
					artist: '',
					album: '',
					icon: 'fa fa-microphone',
					url: 'https://i.mjh.nz/nz/radio.ih.6190'
				});
			} else
				self.commandRouter.logger.info('iheartrad: matches: found nothing');

		} //else if (curUri === 'iheartrad/zm') 
		else {
			self.commandRouter.logger.info('iheartrad: reject');
			response = libQ.reject();
		}
		defer.resolve(response);
    } //if (curUri.startsWith('iheartrad'))
    else
		self.commandRouter.logger.info('iheartrad.handleBrowseUri: No uri specififed: ' + curUri);

    return defer.promise;
};


// Define a method to clear, add, and play an array of tracks
iheartrad.prototype.clearAddPlayTrack = function(track) {
	var self = this;
	var defer = libQ.defer();

	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'iheartrad::clearAddPlayTrack');

	self.commandRouter.logger.info('iheartRad: ' + JSON.stringify(track));

	return self.mpdPlugin.sendMpdCommand('stop', [])
	.then(function() {
		return self.mpdPlugin.sendMpdCommand('clear', []);
	})
	.then(function() {
		return self.mpdPlugin.sendMpdCommand('add "'+track.uri+'"',[]);
	})
	.then(function () {
		self.commandRouter.pushToastMessage('info',
			self.getRadioI18nString('PLUGIN_NAME'),
			self.getRadioI18nString('WAIT_FOR_RADIO_CHANNEL'));
			return self.mpdPlugin.sendMpdCommand('play', []).then(function () {
				switch (track.radioType) {
				  case 'kbs':
				  case 'sbs':
				  case 'mbc':
					return self.mpdPlugin.getState().then(function (state) {
					  return self.commandRouter.stateMachine.syncState(state, self.serviceName);
					});
					break;
				  default:
					self.commandRouter.stateMachine.setConsumeUpdateService('mpd');
					return libQ.resolve();
				}
			  })
			})
			.fail(function (e) {
			  return defer.reject(new Error());
			});
	
};

iheartrad.prototype.seek = function (timepos) {
	var self=this;
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'iheartrad::seek to ' + timepos);

    return this.sendSpopCommand('seek '+timepos, []);
};

// Stop
iheartrad.prototype.stop = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'iheartrad::stop');


};

// Spop pause
iheartrad.prototype.pause = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'iheartrad::pause');


};

// Get state
iheartrad.prototype.getState = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'iheartrad::getState');


};

//Parse state
iheartrad.prototype.parseState = function(sState) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'iheartrad::parseState');

	//Use this method to parse the state and eventually send it with the following function
};

// Announce updated State
iheartrad.prototype.pushState = function(state) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'iheartrad::pushState');

	return self.commandRouter.servicePushState(state, self.servicename);
};


iheartrad.prototype.explodeUri = function(uri) {
	var self = this;
	var defer=libQ.defer();

	// Mandatory: retrieve all info for a given URI
    self.commandRouter.logger.info('iheartRad: explode url:' + uri);

	return defer.promise;
};

iheartrad.prototype.getAlbumArt = function (data, path) {

	var artist, album;

	if (data != undefined && data.path != undefined) {
		path = data.path;
	}

	var web;

	if (data != undefined && data.artist != undefined) {
		artist = data.artist;
		if (data.album != undefined)
			album = data.album;
		else album = data.artist;

		web = '?web=' + nodetools.urlEncode(artist) + '/' + nodetools.urlEncode(album) + '/large'
	}

	var url = '/albumart';

	if (web != undefined)
		url = url + web;

	if (web != undefined && path != undefined)
		url = url + '&';
	else if (path != undefined)
		url = url + '?';

	if (path != undefined)
		url = url + 'path=' + nodetools.urlEncode(path);

	return url;
};





iheartrad.prototype.search = function (query) {
	var self=this;
	var defer=libQ.defer();

	// Mandatory, search. You can divide the search in sections using following functions

	return defer.promise;
};

iheartrad.prototype._searchArtists = function (results) {

};

iheartrad.prototype._searchAlbums = function (results) {

};

iheartrad.prototype._searchPlaylists = function (results) {


};

iheartrad.prototype._searchTracks = function (results) {

};

iheartrad.prototype.goto=function(data){
    var self=this
    var defer=libQ.defer()

	self.commandRouter.logger.info('iheartrad: goto Function');

     return defer.promise;
};

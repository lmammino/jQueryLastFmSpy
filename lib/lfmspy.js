/*!
	LastFM SPY by Luciano Mammino
	----------------------------- 
	Version 1.0
*/
// initializes the Lm namespace if needed
if(typeof(Lm)=="undefined")
    Lm = {};

// Namespaced classes
Lm.Lastfm = {
	Spy : function(apiKey)
	{
		// constructor
		this.init(apiKey);
	},
	
	Track : function(data)
	{
		//constructor
		this.init(data);
	},
	
	User : function(data)
	{
		//constructor
		this.init(data);
	}
};

(function($){
	
	/**
	* Track class definition
	*/
	$.extend(Lm.Lastfm.Track.prototype, {
		
		init: function(data)
		{	
			if(data.date)
			{
				this.id = data.date.uts;
				this.date = new Date(data.date.uts);
				this.nowPlaying = false;
			}
			else
			{
				this.id = null;
				this.date = null;
				this.nowPlaying = true;
			}
			this.title = data.name;
			this.artist = data.artist['#text'];
			this.album = data.album['#text'];
			this.url = data.url;
			this.image = data.image[2]['#text'];
		}
	});
	
	
	
	/**
	*  User class definition
	*/
	$.extend(Lm.Lastfm.User.prototype, {
	
		init: function(data)
		{
			this.id = data.user.id;
			this.name = data.user.name;
			this.realname = data.user.realname;
			this.url = data.user.url;
			this.image = data.user.image[3]['#text'];
			this.country = data.user.country;
			this.age = data.user.age;
			this.gender = data.user.gender;
			this.subscriber = data.user.subscriber;
			this.playcount = data.user.playcount;
			this.playlists = data.user.playlists;
			this.bootstrap = data.user.bootstrap;
			this.registered = new Date(data.user.registered.unixtime);
			this.listeningTo = undefined;
		}
		
	});
	
	
	
	/**
	* Lastfmspy class definition 
	*/
	$.extend(Lm.Lastfm.Spy.prototype, {
		
		version : "1.0",
		
		buildRequest : function(method, params)
		{
			var url = "http://ws.audioscrobbler.com/2.0/?method=" + method;
			for(var key in params)
				url += "&" + key + "=" + params[key];				
			url += "&api_key="+this.apiKey+"&format=json&callback=?";
			return url;
		},
	
		init: function(apiKey)
		{
			this.apiKey = apiKey;
			this.tracks = {};
			this.user = undefined;
			this.trackRetrieveLimit = 30;
			this.autodiscoverFrequence = 2 * 60 * 1000; // 2 minutes
			this.autodiscoverInterval = undefined;
			this._listeners = {};
		},
		
		addListener: function(type, listener)
		{
		    if ( typeof this._listeners[type] == "undefined" )
			{
	            this._listeners[type] = [];
	        }
	        this._listeners[type].push(listener);
		},

	    fire: function(event)
		{
	        if (typeof event == "string")
			{
	            event = { type: event };
	        }
	        if (!event.target)
			{
	            event.target = this;
	        }

	        if (!event.type)
			{  //falsy
	            throw new Error("Event object missing 'type' property.");
	        }

	        if (this._listeners[event.type] instanceof Array)
			{
	            var listeners = this._listeners[event.type];
	            for (var i=0, len=listeners.length; i < len; i++)
				{
	                listeners[i].call(this, event);
	            }
	        }
	    },

	    removeListener: function(type, listener)
		{
	        if (this._listeners[type] instanceof Array)
			{
	            var listeners = this._listeners[type];
	            for (var i=0, len=listeners.length; i < len; i++)
				{
	                if (listeners[i] === listener)
					{
	                    listeners.splice(i, 1);
	                    break;
	                }
	            }
	        }
	    },
		
		loadUser: function(userName, callback)
		{
			self = this;
			
			this.fire({
				type : "userLoading",
				data : {
					user : userName
				}
			});
			$.getJSON( this.buildRequest("user.getInfo", { user : userName }), 
				function(data)
				{
					if(data.error)
						throw {
							name : "userLoadingError",
							message : data.message
						};
						
					self.user = new Lm.Lastfm.User(data);
					self.fire({
						type : "userLoaded",
						data : {
							user : self.user
						}
					});
					
					if(callback)
						callback(data);
				});

			return this;
		},
		
		loadNewTracks: function(callback)
		{
			var self = this;
			
			this.fire({
				type : "tracksLoading",
				data : {
					limit : this.trackRetrieveLimit
				}
			});
				
			$.getJSON( this.buildRequest("user.getrecenttracks", { user : this.user.name, limit : this.trackRetrieveLimit }), 
				function(data)
				{
					if(data.error)
						throw {
							name : "tracksLoadingError",
							message : data.message
						};

					loadedTracks = [];
					newTracks = [];
					
					var tracks = data.recenttracks.track;
					var i=0;

					if(tracks[0]['@attr'] && tracks[0]['@attr'].nowplaying)
					{	
						var nowPlaying = new Lm.Lastfm.Track(tracks[0]);
						i = 1;
						
						self.fire({
							type : "nowPlaying",
							data : {
								track : nowPlaying
							}
						});
						self.user.listeningTo = nowPlaying;
					}
					else
					{
						if(self.user.listeningTo)
						{
							self.user.listeningTo = undefined;
							self.fire({
								type : "notPlaying"
							});
						}
					}
					
					for(i; i < tracks.length; i++)
					{
						track = new Lm.Lastfm.Track(tracks[i]);
						loadedTracks.push(track);
						
						//check if the loaded track is new
						if(!self.tracks[track.id])
						{
							newTracks.push(track);
							self.tracks[track.id] = track;
						}
					}
					
					// fire tracksLoaded
					self.fire({
						type : "tracksLoaded",
						data : {
							tracks : loadedTracks
						}
					});
					
					// fire newTracks
					if(newTracks.length > 0)
					{
						self.fire({
							type : "newTracks",
							data : {
								tracks : newTracks
							}
						});
					}
					
					if(callback)
						callback(data);
				});
			
			return this;
		},
		
		clearTracks : function()
		{
			this.tracks = {};
			this.fire({
				type : "clearTracks"
			});
		},
		
		startAutodiscover : function(frequence)
		{
			var client = this;
			if(typeof(frequence) == 'undefined')
				frequence = this.autodiscoverFrequence;
			
			this.autodiscoverInterval = setInterval( function(){client.loadNewTracks();} , frequence);
			
			this.fire({
				type : "autodiscoverStarted",
				data : {
					frequence : frequence
				}
			});
			
			return this;
		},
		
		endAutodiscover: function()
		{
			if(this.autodiscoverInterval)
			{
				clearInterval(this.autodiscoverInterval);
				this.fire({
					type : "autodiscoverEnded"
				});
			}
				
			return this;
		},
		
		quickstart: function(username, startTracks, trackRetrieveLimit, frequence)
		{
			var client = this;
			
			if(typeof(username) == 'undefined')
				throw ReferenceError("username passed");
			
			if(typeof(startTracks) == 'undefined')
				startTracks = this.trackRetrieveLimit;
				
			if(typeof(trackRetrieveLimit) == 'undefined')
				trackRetrieveLimit = this.trackRetrieveLimit;
				
			if(typeof(frequence) == 'undefined')
				frequence = this.autodiscoverFrequence;
			
			client.clearTracks();
			client.endAutodiscover();
			
			client.loadUser(username, function(data){
				client.trackRetrieveLimit = startTracks;
				client.loadNewTracks(function(data){
					client.trackRetrieveLimit = trackRetrieveLimit;
					client.startAutodiscover(frequence);
				});
			});
		}
		
	});
})(jQuery);
/*!
	LastFM SPY by Luciano Mammino
	----------------------------- 
	Version 1.0
*/
// initializes the Lm namespace and Lastf classes if needed
if(typeof(Lm)=="undefined" || typeof(Lm.Lastfm)=="undefined")
    var Lm = 
    {
    	Lastfm : 
    	{
    		Track 	: null,
    		User  	: null,
    		Spy		: null,
    		version : "1.0"
    	}
    };

(function($){
	
	/**
	* Track class definition
	*/
	Lm.Lastfm.Track = function(data) 
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
	};
	
	
	
	/**
	*  User class definition
	*/
	Lm.Lastfm.User = function(data)
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
	};
	
	
	
	/**
	* Lastfmspy class definition 
	*/	
	Lm.Lastfm.Spy = function(apiKey)
	{
		this.apiKey = apiKey;
		this.tracks = {};
		this.user = undefined;
		this.trackRetrieveLimit = 30;
		this.autodiscoverFrequence = 2 * 60 * 1000; // 2 minutes
		this.autodiscoverInterval = undefined;
		this._listeners = {};
		
		this.buildRequest = function(method, params)
		{
			var url = "http://ws.audioscrobbler.com/2.0/?method=" + method;
			for(var key in params)
				url += "&" + key + "=" + params[key];				
			url += "&api_key="+this.apiKey+"&format=json&callback=?";
			return url;
		};
	
		this.addListener = function(type, listener)
		{
		    if ( typeof this._listeners[type] == "undefined" )
			{
		        this._listeners[type] = [];
		    }
		    this._listeners[type].push(listener);
		};
		
		this.fire = function(event)
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
	    };
	    
	    this.removeListener = function(type, listener)
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
	    };
	    
	    this.loadUser = function(userName, callback)
		{	
			this.fire({
				type : "userLoading",
				data : {
					user : userName
				}
			});
			
			$.ajax({
			  url		: this.buildRequest("user.getInfo", { user : userName }),
			  dataType	: 'json',
			  context	: this,
			  success	: function(data)
			  {	
			  	if(data.error)
			  		throw {
			  			name : "userLoadingError",
			  			message : data.message
			  		};
			  	this.user = new Lm.Lastfm.User(data);
			  	this.fire({
			  		type : "userLoaded",
			  		data : {
			  			user : this.user
			  		}
			  	});
			  	
			  	if(callback)
			  	{
			  		callback.apply(this, new Array(data));
			  	}
			  }
			});
	
			return this;
		};
		
		this.loadNewTracks = function(callback)
		{
			this.fire({
				type : "tracksLoading",
				data : {
					limit : this.trackRetrieveLimit
				}
			});
	
			$.ajax({
			  url		: this.buildRequest("user.getrecenttracks", { user : this.user.name, limit : this.trackRetrieveLimit }),
			  dataType	: 'json',
			  context	: this,
			  success	: function(data)
				{	
					if(data.error)
						throw {
							name : "tracksLoadingError",
							message : data.message
						};
	
					loadedTracks = [];
					newTracks = [];
					
					var tracks = data.recenttracks.track;
					
					//normalizes the data in case of a single result
					if( !( tracks instanceof Array ) )
					{
						tracks = [tracks];
					}
					
					var i=0;
	
					if(typeof(tracks[0]['@attr']) != 'undefined' && tracks[0]['@attr'].nowplaying)
					{	
						var nowPlaying = new Lm.Lastfm.Track(tracks[0]);
						i = 1;
						
						this.fire({
							type : "nowPlaying",
							data : {
								track : nowPlaying
							}
						});
						this.user.listeningTo = nowPlaying;
					}
					else
					{
						this.user.listeningTo = undefined;
						this.fire({
							type : "notPlaying"
						});
					}
					
					for(i; i < tracks.length; i++)
					{
						track = new Lm.Lastfm.Track(tracks[i]);
						loadedTracks.push(track);
						
						//check if the loaded track is new
						if(!this.tracks[track.id])
						{
							newTracks.push(track);
							this.tracks[track.id] = track;
						}
					}
					
					// fire tracksLoaded
					this.fire({
						type : "tracksLoaded",
						data : {
							tracks : loadedTracks
						}
					});
					
					// fire newTracks
					if(newTracks.length > 0)
					{
						this.fire({
							type : "newTracks",
							data : {
								tracks : newTracks
							}
						});
					}
					
					if(callback)
						callback.apply(this, new Array(data));
				}
			});
			
			return this;
		};
	
	
		this.clearTracks = function()
		{
			this.tracks = {};
			this.fire({
				type : "clearTracks"
			});
		};
		
		this.startAutodiscover = function(frequence)
		{	
			if(typeof(frequence) == 'undefined')
				frequence = this.autodiscoverFrequence;
			
			// this.timer = setInterval ( function( that ) { that.updateTime(); }, 999, this );
			this.autodiscoverInterval = setInterval( function(instance){
				instance.loadNewTracks();
			} , frequence, this);
			
			this.fire({
				type : "autodiscoverStarted",
				data : {
					frequence : frequence
				}
			});
			
			return this;
		};
		
		this.endAutodiscover = function()
		{
			if(this.autodiscoverInterval)
			{
				clearInterval(this.autodiscoverInterval);
				this.fire({
					type : "autodiscoverEnded"
				});
			}
				
			return this;
		};
		
		this.quickstart = function(username, startTracks, trackRetrieveLimit, frequence)
		{	
			if(typeof(username) == 'undefined')
				throw ReferenceError("username passed");
			
			if(typeof(startTracks) == 'undefined')
				startTracks = this.trackRetrieveLimit;
				
			if(typeof(trackRetrieveLimit) == 'undefined')
				trackRetrieveLimit = this.trackRetrieveLimit;
				
			if(typeof(frequence) == 'undefined')
				frequence = this.autodiscoverFrequence;
			
			this.clearTracks();
			this.endAutodiscover();
			
			this.loadUser(username, function(data){
				this.trackRetrieveLimit = startTracks;
				this.loadNewTracks(function(data){
					this.trackRetrieveLimit = trackRetrieveLimit;
					this.startAutodiscover(frequence);
				});
			});
		};
		
	}; //end Lm.Lastfm.Spy
})(jQuery);
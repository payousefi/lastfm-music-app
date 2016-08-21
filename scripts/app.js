/**
  * Main javascript file for music.payamyousefi.com
  * by Payam Yousefi | last updated August 21, 2016
  */

'use strict'; // Keep global scope happy

var MusicApp = function(user, key, wrap, content){
  // Initialize some variables
  var self = this;
  this.username = user;
  this.wrapper = $(wrap);
  this.fill = $(content);
  this.apikey = key;

  // Make the last.fm API request
  this.go = function() {
    'use strict';
    var baseURL = "http://ws.audioscrobbler.com/2.0/";
    var method = "user.getTopArtists";
    var limit = 12;
    var period = "1month"; // Last 30 days
    var queryURL = baseURL+"?method="+method+"&user=" + self.username + "&api_key="+self.apikey+"&limit="+limit+"&period="+period+"&format=json";
    $.getJSON(queryURL, self.printData);
  };

  this.printData = function(data) {
    'use strict';
    var html = '';
    if (!data.error && data.topartists && data.topartists.artist.length != 0) {
      // Generate each artist tile
      $.each(data.topartists.artist, function(i, item) {
        var imgsrc = '';
        if (item.image && item.image[4] && item.image[4]["#text"] != "") {
          imgsrc = 'style="background-image:url(' + item.image[4]["#text"] + ');" ';
        }
        html += '<a href="' + item.url + '"><div class="artist" ' + imgsrc + 'title="' + item.name + '"><div class="title">' + item.name + '<span>' + item.playcount + ' plays</span></div><div class="dark"></div></div></a> ';
      });

      // Fade in new background color
      self.wrapper.animate({
        "backgroundColor": jQuery.Color({
          hue: Math.round(Math.random() * 359),
          saturation: ((Math.random() * 0.3) + 0.3).toFixed(2),
          lightness: ((Math.random() * 0.3) + 0.1).toFixed(2)
        })
      }, 700);

    } else {
      // Load error message
      html = '<p><em>User was not found on last.fm, or there was not enough data from the past month available.</em></p>';
    }

    // Append and show data
    self.fill.append(html);
    self.fill.slideDown(2000);
  };
};

// JQuery loaded?
$(document).ready(function() {

  'use strict';

  /* Detect URL routing */
  var path = window.location.pathname.split('/');
  var username = (path[1] != null && path[1] != "") ? path[1] : "solitude12";

  // Initialize and run the app
  var app = new MusicApp(username, "***REMOVED***", "#wrap", ".content");
  app.go();

  /* Form functionality */
  $("#username").keypress(function(event) {
    var keycode = (event.keyCode ? event.keyCode : event.which);
    if (keycode == "13") { // on enter/return, relocate to correct endpoint
        window.location = "http://music.payamyousefi.com/" + $("#username").val();
    }
  });


});

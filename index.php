<?php

  /* Some basic PHP routing: */

  // Redirect to proper subdomain if in wrong directory
  if(strstr($_SERVER['REQUEST_URI'],"/music/")){
    $current = str_replace($_SERVER["REQUEST_URI"], "/music/", "");
    header('location: https://music.payamyousefi.com/'.$current);
  }

  // Redirect to base / URL
  if(strstr($_SERVER['REQUEST_URI'],"index.php")){
    header('location: https://music.payamyousefi.com/');
  }

  // Parse URL arguments
  $root = explode('/', $_SERVER['REQUEST_URI']);
  array_shift($root);


  /* Set title and user info details */

  if ($root[0] == "") { // Home page

    $title = "Payam Yousefi";
    $whos = "my";

  } else { // Custom user request

    $title = $root[0];
    $whos = "<a href='https://last.fm/user/".$root[0]."' target='_blank' rel='noopener noreferrer'>".$root[0]."</a>'s";

  }

?>
<!DOCTYPE html>
<html>
<head>
  <title>Music &mdash; <?php echo $title; ?></title>
  <meta http-equiv="content-type" content="text/html; charset=utf-8">
  <meta name="keywords" content="music, last.fm, design, personal, payam yousefi, css3, javascript">
  <meta name="description" content="Curious about <?php echo strip_tags($whos); ?> taste in music? This past month&rsquo;s top artists are&hellip;">
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <!-- SEO/Social -->
  <meta property="og:image" content="img/screenshot.jpg" />
  <link href="favicon.ico" rel="icon">

  <!-- Stylesheets -->
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Karla:wght@400;700&family=Lobster&display=swap">
  <link rel="stylesheet" href="stylesheets/reset.css">
  <link rel="stylesheet" href="stylesheets/main.css">

  <!-- App Script (no external dependencies) -->
  <script src="scripts/app.js" defer></script>

</head>

<body>

  <!-- main wrapper -->
  <div id="wrap">
    
    <header>
      <h1><a href="/">&#8220;What kind of music do you like?&#8221;</a></h1>
      <h2>
        Curious about <?php echo $whos; ?> taste in music?<br/>
        This past month&rsquo;s top artists are&hellip;
      </h2>
    </header>

    <hr/>

    <p>Have your own <a href="https://last.fm/" target="_blank" rel="noopener noreferrer">last.fm</a> account? Type in your username: &nbsp;<input type="text" id="username" value="" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-form-type="other"/>&nbsp; and press <b>enter</b>.</p>

    <hr/>

    <!-- load the music data! -->
    <div class="content" style="display:none;"></div>

    <footer>
      <p>{ designed by <a href="https://payamyousefi.com/" target="_blank" rel="noopener noreferrer">Payam Yousefi</a> &middot; &middot; &middot; play data via <a href="https://last.fm/" target="_blank" rel="noopener noreferrer">Last.fm</a> &middot; artist data via <a href="https://musicbrainz.org/" target="_blank" rel="noopener noreferrer">MusicBrainz</a> + <a href="https://www.discogs.com/" target="_blank" rel="noopener noreferrer">Discogs</a> + <a href="https://www.theaudiodb.com/" target="_blank" rel="noopener noreferrer">TheAudioDB</a> }</p>
    </footer>

  </div>

  <!-- Google Analytics 4 -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-VB31S6GZ1J"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-VB31S6GZ1J');
  </script>
</body>
</html>

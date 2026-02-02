<?php
  // Parse username from URL path for SEO-friendly title/subtitle
  $path = trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
  $username = $path !== '' ? htmlspecialchars($path, ENT_QUOTES, 'UTF-8') : '';
  
  if ($username === '') {
    $title = "Payam Yousefi";
    $whos = "my";
  } else {
    $title = $username;
    $whos = "<a href='https://last.fm/user/{$username}' target='_blank' rel='noopener noreferrer'>{$username}</a>'s";
  }
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Music &mdash; <?php echo $title; ?></title>
  <meta http-equiv="content-type" content="text/html; charset=utf-8">
  <meta name="keywords" content="music, last.fm, design, personal, payam yousefi, css3, javascript">
  <meta name="description" content="Curious about <?php echo strip_tags($whos); ?> taste in music? This past month&rsquo;s top artists are&hellip;">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta property="og:image" content="img/screenshot.jpg" />
  <link href="favicon.ico" rel="icon">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Karla:wght@400;700&family=Lobster&display=swap">
  <link rel="stylesheet" href="stylesheets/reset.css">
  <link rel="stylesheet" href="stylesheets/main.css">
  <script src="scripts/app.js" defer></script>
</head>

<body>

  <!-- Skip link for keyboard navigation -->
  <a href="#main-content" class="skip-link">Skip to main content</a>

  <!-- main wrapper -->
  <div id="wrap">
    
    <header>
      <h1><a href="/">&#8220;What kind of music do you like?&#8221;</a></h1>
      <h2>
        Curious about <?php echo $whos; ?> taste in music?<br/>
        This past month&rsquo;s top artists are&hellip;
      </h2>
    </header>

    <hr aria-hidden="true"/>

    <p>
      Have your own <a href="https://last.fm/" target="_blank" rel="noopener noreferrer">last.fm</a> account?
      <label for="username" class="visually-hidden">Enter your Last.fm username</label>
      <span aria-hidden="true">Type in your username: &nbsp;</span>
      <input type="text" id="username" value="" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-form-type="other" aria-label="Last.fm username" placeholder="username"/>
      <span aria-hidden="true">&nbsp; and press <b>enter</b>.</span>
    </p>

    <hr aria-hidden="true"/>

    <!-- Main content area with ARIA live region for dynamic updates -->
    <main id="main-content" role="main">
      <p class="rate-limit-note">Artist images load progressively due to <a href="https://www.discogs.com/developers" target="_blank" rel="noopener noreferrer">Discogs API</a> rate limiting (60 requests/minute).</p>
      <div class="content" style="display:none;" aria-live="polite" aria-atomic="false"></div>
    </main>

    <footer>
      <div class="image-sources-config" role="radiogroup" aria-label="Primary image source"></div>
      
      <p>{ designed by <a href="https://payamyousefi.com/" target="_blank" rel="noopener noreferrer">Payam Yousefi</a> &middot; &middot; &middot; play data via <a href="https://last.fm/" target="_blank" rel="noopener noreferrer">Last.fm</a> &middot; artist data via <a href="https://musicbrainz.org/" target="_blank" rel="noopener noreferrer">MusicBrainz</a> + <a href="https://www.discogs.com/" target="_blank" rel="noopener noreferrer">Discogs</a> + <a href="https://www.theaudiodb.com/" target="_blank" rel="noopener noreferrer">TheAudioDB</a> + <a href="https://affiliate.itunes.apple.com/resources/documentation/itunes-store-web-service-search-api/" target="_blank" rel="noopener noreferrer">iTunes</a> }</p>
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

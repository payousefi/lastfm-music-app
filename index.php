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
  <meta name="description" content="Curious about <?php echo strip_tags($whos); ?> taste in music? Over the past month...">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta property="og:image" content="img/screenshot.jpg" />
  <link href="favicon.ico" rel="icon">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Karla:wght@400;700&family=Lobster&display=swap">
  <link rel="stylesheet" href="stylesheets/reset.css">
  <link rel="stylesheet" href="stylesheets/main.css">
  <script src="scripts/personality-headlines.js" defer></script>
  <script src="scripts/app.js" defer></script>
</head>

<body>

  <!-- main wrapper -->
  <div id="wrap">
    
    <header>
      <h1><a href="/">&#8220;What kind of music do you like?&#8221;</a></h1>
      <h2>
        Curious about <?php echo $whos; ?> taste in music in the last month?<br/>
      </h2>
    </header>

    <hr aria-hidden="true"/>

    <div class="username-section">
      <p>
        Have your own <a href="https://last.fm/" target="_blank" rel="noopener noreferrer">last.fm</a> account?
        <label for="username" class="visually-hidden">Enter your Last.fm username</label>
        <span aria-hidden="true">Type in your</span>
        <input type="text" id="username" value="" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-form-type="other" aria-label="Last.fm username" placeholder="username"/>
        <span aria-hidden="true">and press <b>enter</b>.</span>
      </p>
    </div>

    <!-- Main content area with ARIA live region for dynamic updates -->
    <main role="main">
      <p class="music-personality" aria-live="polite"></p>
      <p class="rate-limit-note">Artist images load at slower speeds while adapting to API rate limit.</p>
      <div class="content" aria-live="polite" aria-atomic="false"></div>
    </main>

    <footer>
      <div class="image-sources-config" role="radiogroup" aria-label="Primary image source"></div>
      
      <hr aria-hidden="true"/>

      <div class="footer-content">
        <!-- Copyright group -->
        <p class="footer-copyright">&copy; <?php echo date('Y'); ?> <a href="https://payamyousefi.com/" target="_blank" rel="noopener noreferrer">Payam Yousefi</a> · designed &amp; developed by Payam</p>
        
        <!-- Data sources group -->
        <p class="footer-data">
          <span class="data-group play-data">play data via <a href="https://last.fm/" target="_blank" rel="noopener noreferrer">Last.fm</a></span>
          <span class="data-sep"> · </span>
          <span class="data-group artist-data">artist data via <a href="https://musicbrainz.org/" target="_blank" rel="noopener noreferrer">MusicBrainz</a> · <a href="https://www.discogs.com/" target="_blank" rel="noopener noreferrer">Discogs</a> · <a href="https://www.theaudiodb.com/" target="_blank" rel="noopener noreferrer">TheAudioDB</a> · <a href="https://performance-partners.apple.com/search-api" target="_blank" rel="noopener noreferrer">iTunes</a></span>
        </p>
      </div>
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

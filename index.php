<?php

  /* Some basic PHP routing: */

  // Redirect to proper subdomain if in wrong directory
  if(strstr($_SERVER['REQUEST_URI'],"/music/")){
    $current = str_replace($_SERVER["REQUEST_URI"], "/music/", "");
    header('location: http://music.payamyousefi.com/'.$current);
  }

  // Redirect to base / URL
  if(strstr($_SERVER['REQUEST_URI'],"index.php")){
    header('location: http://music.payamyousefi.com/');
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
    $whos = "<a href='http://last.fm/user/".$root[0]."'>".$root[0]."</a>'s";

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
  <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Karla:400,700|Lobster" type="text/css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.6.3/css/font-awesome.min.css" type="text/css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/jquery.jssocials/1.3.1/jssocials.css" type="text/css" />
  <link rel="stylesheet" href="stylesheets/reset.css" type="text/css">
  <link rel="stylesheet" href="stylesheets/main.css" type="text/css">

  <!-- Load JS/JQuery scripts -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pace/1.0.2/pace.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.4/jquery.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery-color/2.1.2/jquery.color.min.js" type="text/javascript"></script>
  <script type="text/javascript" src="https://cdn.jsdelivr.net/jquery.jssocials/1.3.1/jssocials.min.js"></script>
  <script src="scripts/app.js" type="text/javascript"></script>

</head>

<body>

  <!-- social links -->
  <div class="social"></div>

  <!-- main wrapper -->
  <div id="wrap">
    
    <header>
      <h1><a href="http://music.payamyousefi.com">&#8220;What kind of music do you like?&#8221;</a></h1>
      <h2>
        Curious about <?php echo $whos; ?> taste in music?<br/>
        This past month&rsquo;s top artists are&hellip;
      </h2>
    </header>

    <hr/>

    <p>Have your own <a href="http://last.fm/">last.fm</a> account? Type in your username: &nbsp;<input type="text" id="username" value=""/>&nbsp; and press <b>enter</b>.</p>

    <hr/>

    <!-- load the music data! -->
    <div class="content" style="display:none;"></div>

    <footer>
      <p>{ designed by <a href="http://payamyousefi.com/">Payam Yousefi</a> &middot; &middot; &middot; monthly play count + image data collected via <a href="http://last.fm/">Last.fm</a> API }</p>
    </footer>

  </div>

  <!-- analytics -->
  <script>
    (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
    (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
    m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
    })(window,document,'script','//www.google-analytics.com/analytics.js','ga');

    ga('create', 'UA-46647973-1', 'payamyousefi.com');
    ga('send', 'pageview');

  </script>
</body>
</html>

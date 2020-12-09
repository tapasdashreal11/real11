'use strict';

const gulp = require('gulp');
const { src, dest, parallel, series } = require('gulp');
const makeDir = require('mkdirp');
const dotenv = require('dotenv');
const logger = require('./utils/logger')(module);
const nodemon = require('gulp-nodemon');
const homedir = require('homedir');
const eslint = require('gulp-eslint');
const exec = require('child_process').exec;
const runSequence = require('run-sequence');
const browserSync = require('browser-sync');
const gulpLoadPlugins =  require('gulp-load-plugins');
const del = require('del');
const minifyejs = require('gulp-minify-ejs');
const config    = require('./server/config').express;
const serverEnv = config.isOnProduction ? 'production' : 'development';

const $ = gulpLoadPlugins();
const reload = browserSync.reload;

/*
Build options
USAGE: gulp build -env prod
*/
const buildOption = process.argv[4];
let DEST_PATH;
if (buildOption) {
  switch (buildOption) {
    case 'prod':
      DEST_PATH = 'dist/public';
      break;
    default:
      DEST_PATH = 'client/public';
      break;
  }
  logger.info('Setting build destination to ', DEST_PATH);
} else {
  DEST_PATH = config.isOnProduction ? 'dist/public' : 'client/public';
}

const SOURCE_PATHS = {
    styles: [
      'client/sass/**/*.scss',
      'client/vendor/styles/**/*.css',
      //TODO: Disable old CSS if not needed
      'client/styles/**/*.css',
      ],
    scripts: [
      // list scripts here in the right order to be correctly concatenated
       'client/vendor/js/*.js',
       'client/js/*.js',
      ],
    images: 'client/images/**/*',
    views: 'views/**/*.ejs',
    filesToCopy: [
      'client/loaderio-59f5eec3f3df1b817bec122e1117860f.txt',
      'client/robots.txt',
      'client/favicon.ico',
      'client/sitemap.xml'
    ]
};

// Lint Javascript
const lint = (cb) => {
   src(['**/*.js', '!node_modules/**'])
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failAfterError())
        cb();
      };

exports.lint = lint

// Optimize images
const images = (cb) => {
  src(SOURCE_PATHS.images)
    .pipe($.cache($.imagemin({
      progressive: true,
      interlaced: true
    })))
    .pipe(dest(`${DEST_PATH}/images`))
    .pipe($.size({title: 'images'}))
    cb();
};

exports.images = images

// Copy required public files to dist/public
const copy = (cb) => {
  src(SOURCE_PATHS.filesToCopy, {dot: true})
  .pipe(dest('dist/public'))
  .pipe($.size({title: 'copy'}))
  cb();
}

exports.copy = copy

const sass = (cb) => {
  return src('client/sass/**/*.scss')
    .pipe($.sourcemaps.init())
    .pipe($.sass(sassOptions).on('error',$.sass.logError))
    .pipe($.sourcemaps.write())
    .pipe(dest(`${DEST_PATH}`))
    cb();
}

exports.sass = sass

// Compile and automatically prefix stylesheets
const styles = (cb) => {
  const AUTOPREFIXER_BROWSERS = [
    'ie >= 10',
    'ie_mob >= 10',
    'ff >= 30',
    'chrome >= 34',
    'safari >= 7',
    'opera >= 23',
    'ios >= 7',
    'android >= 4.4',
    'bb >= 10'
  ];

  const sassOptions = {
    outputStyle: 'expanded',
    errLogToConsole: true,
    precision: 10
  };

  return src(SOURCE_PATHS.styles)
    .pipe($.newer('.tmp/styles'))
    .pipe($.sourcemaps.init())
    .pipe($.sass(sassOptions).on('error', $.sass.logError))
    .pipe($.autoprefixer(AUTOPREFIXER_BROWSERS))
    .pipe(dest('.tmp/styles'))
    .pipe($.uglifycss({"uglyComments": true, "maxLineLen": 80}))
    // TODO: Concatenate styles
    //.pipe($.if('*.css', $.cssnano()))
    .pipe($.size({title: 'styles'}))
    .pipe($.sourcemaps.write('./'))
    .pipe(dest(`${DEST_PATH}/styles`))
    .pipe(dest('.tmp/styles'));
    cb();
};

exports.styles = styles

// Concatenate and minify JavaScript.
const scripts = (cb) => {
    return src(SOURCE_PATHS.scripts)
      .pipe($.newer('.tmp/scripts'))
      .pipe($.sourcemaps.init())
      .pipe($.babel({
        ignore : [], //causing error after transpiled
        presets: ['env']
      }))
      .pipe($.sourcemaps.write())
      .pipe(dest('.tmp/scripts'))
      // TODO: enable Concatenation
      //.pipe($.concat('main.min.js'))
      .pipe($.uglify({preserveComments: 'some'}))
      // Output files
      .pipe($.size({title: 'scripts'}))
      .pipe($.sourcemaps.write('.'))
      .pipe(dest(`${DEST_PATH}/js`))
      .pipe(dest('.tmp/scripts'))
};
exports.scripts = scripts;

// Minify EJS views
const minifyEjs = (cb) => {
  return src(SOURCE_PATHS.views)
    .pipe(minifyejs())
    //.pipe(rename({suffix:".min"}))
    .pipe(dest(`${DEST_PATH}/views/`))
};
exports.minifyEjs = minifyEjs

// Clean dev output public directory
const clean = () => del([
    //Files and directory to delete
    '.tmp',  'client/public/*'
    ], {dot: true});
exports.clean = clean

// Clean dist directory
const cleanDist = () => del([
    //Files and directory to delete
    '.tmp', '!dist/.git', 'dist/*'
    ], {dot: true});

exports.cleanDist = cleanDist

// Setup environemnt app keys and mongodb datapath
const setupEnv  = (cb) => {
  var userHomeDir = homedir();
  var dbpath = `${userHomeDir}/data/db`;
     // Setup all the environments variables for the app
  dotenv.config({
    path: './.env-configs',
  });

  // Create mongo data directory
  makeDir(dbpath).then((err) => {
    if (err) {
      logger.error('Error creating mongo data directory', err);
    } else {
      logger.info('db path created');
    }
    cb();
  });
};
exports.setupEnv = setupEnv;

// Repair mongo
const repairMongo = series(setupEnv, (cb) => {
   // start mongodb server
  exec('mongod --dbpath ~/data/db --repair', (err, stdout, stderr) => {
    if (err) logger.error(err); // return error
    // if (stderr) logger.error(stderr);
    logger.info(stdout);
    logger.error(stderr);
    cb();
  });
});
exports.repairMongo = repairMongo;

// Initiate mongo db
const initMongo = series(setupEnv,(cb) => {
   // start mongod service
  exec('mongod --dbpath ~/data/db --port 27017 --replSet "rs0"', (err, stdout) => {
    if (err) logger.error('Error starting mongodb', err);
    logger.info(stdout);
    
  });
  cb();
});
exports.initMongo =  initMongo;

// Watch files for changes & reload
const watch = series(scripts, styles, images, (cb) => {
  gulp.watch(SOURCE_PATHS.styles, ['styles', reload]);
  gulp.watch(SOURCE_PATHS.scripts, ['scripts', reload]);
  gulp.watch(SOURCE_PATHS.images, ['images', reload]);
  cb();
});

//Initialize mongo-replica settings. Failing to do so will prevent reading and writing to the mongodb, and cause mongo-connector to refuse to start.
//In the future if data duplication becomes neccesary this will makes more sense, but for now we need the replica oplog for mongo-connector to function
const initMongoRepl = series(initMongo, cb => {
  setTimeout(f=>{
      //Initialize the mongodb as a single node replica
      exec("mongo --eval \"rs.initiate( {_id: 'rs0',  members: [{ _id: 0, host : 'localhost:27017'}]})\"", (err, stdout) => {
          logger.info("Initiating replicashards: \n",stdout);
          if (err) logger.error('Error allowing reading from secondary shards. This may prevent mongo from functioning.', err);
      });
      //Allow reading of this single node replica
      setTimeout(f=>{
          exec('mongo --eval "db.getMongo().setSlaveOk()"', (err, stdout) => {
              logger.info("Allowing Reading secondary shards: \n");
              if (err) logger.error('Error allowing reading from secondary shards. This may prevent mongo from functioning.', err);
          });
      },1000);
  },1000);
  cb();
});
exports.initMongoRepl = initMongoRepl

// Start server and watch for files
//init-mongo is replaced by init-connector(initializing mongo-connector), which requires init-mongo as requirement
const serve = series(setupEnv, initMongoRepl, (cb) => {
  logger.info(`Starting ${serverEnv} server... `);
  nodemon({
    script: './server/server.js',
    ext: 'ejs js html css scss',
    env: { NODE_ENV: serverEnv}
  });
  cb();
});
exports.serve = serve;

// Start server and watch for files
const debug = series(setupEnv, initMongoRepl, watch,(cb) => {
  logger.info(`Starting ${serverEnv} server... `);
  nodemon({
    script: './server/server.js',
    nodeArgs: ['--inspect'],
    ext: 'ejs js html css scss',
    env: { NODE_ENV: serverEnv}
  });
  cb();
});
exports.debug = debug;

// Build all files, default task
const defaults = series(clean,(cb) => {
  runSequence(
    'styles',
    ['lint',  'scripts', 'images', 'copy'],
    cb()
  )
});

// Build all files, default task
const build =  (cb) => { 
  series(styles, lint, scripts, images, copy)
  cb();
}
exports.build = build


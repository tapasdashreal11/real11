## Setup Development Environment
In order to run the application on your local environment download and install below packages.

 1. Download and Install nodejs: https://docs.npmjs.com/getting-started/installing-node
 2. Download and Install mongodb: https://docs.mongodb.com/manual/installation/   

 ### Mongo Database set-up
  Steps to set up mongodb for disconnected local development   
  + In root directory, create `data` directory:   
  		``` mkdir ~/data/db ```   
  + Run this command to start your mongod server:   
 		``` mongod --dbpath ~/data/db --port 27017 ```

## Test and Run App

### System Requirements

Our start-up scripts are mainly targeted at *NIX users, so if you are on Linux or MacOS, great.  If, howewer, you choose to run Windows - we recommend cygwin (https://www.cygwin.com/), some virtualization tool like VirtualBox (https://www.virtualbox.org/wiki/VirtualBox) & Vagrant (https://www.vagrantup.com/), Docker (https://www.docker.com/), or lots of patience and luck.

> **Important Note**: If you face any problems during the installation with your latest version of node then try using an older version of node and npm. We suggest to use v8.12.0 for node and 6.4.1 for npm

### Common Steps for setup
  1. ```git clone https://github.com/rajatjain4061/real11-node.git```
  1. ```cd real11-node```
  1. ```npm install```

### Start-up Using the new ```gulp``` runner
> This method will start up mongo daemon and nodemon process for hot reload, so it's the minimal extra effort approach
  1. ``` npm install -g gulp ```
  2. ``` gulp build ``` will build the scripts and styles. Note if you notice the scripts or styles were not correctly build try running `gulp clean` and then `gulp build` again.
  5. ```sudo gulp serve```

### Start-up using npm scripts
> This method involves extra steps, but has some powerful advantages, like enabling hot reload, debugging and profiling
  1. Start mongodb server locally: In separate terminal type ```mongod```
  2. Build the client files with `gulp build`. Then in separate terminal within the project directory run `gulp watch` to automaticaly rebuild client files whenever they change.
  4. Start the platerate app:
      * ```npm start``` will start it normally, restarts will be needed to reload code changes
      * ```npm run start-hot``` will start it in hot-reload mode, picking up the changes to files, great for active development
      * ```npm run debug``` will listen for Chrome dev tools to connect for live debugging
      * ```npm run profile``` will allow collect profiling information (see https://nodejs.org/en/docs/guides/simple-profiling/ for details)
  4. The local server will start running on: http://localhost:3003/
  

## Development Instructions
 Follow below instructions for development in your local environment:
 1. Clone or fetch latest updates from develop branch on Github	``` git pull origin develop```
 
 1. Create your local branch for your updates: checkout  a new branch from develop branch.  If you are creating a branch for an open issue, keep the branch name as `issue-<issue#>`. For new features keep branch name as `feature-<short name for the feature>`.  
 
 1. Use the following naming conventions for branches
 	+ `wip`       Works in progress; stuff I know won't be finished soon
	+ `feat`      Feature I'm adding or expanding
	+ `bug`       Bug fix or experiment
	+ `junk`      Throwaway branch created to experiment
 
 1.  ``` git checkout -b  <branch name> ```
 
 1. Work locally in the branch you created, and add and commit your changes(*Note: Make sure to **only add the files that are part of your updates** and do not incude any generated client files from client/public*)
 		``` git add <path of file with updated changes>```    
		``` git commit -m ‘<a short and meaningful comment for your updates>’```  
		
 1. Test your updates on local branch.   
 	+ Start server and make sure no errors were introduced   
 	+ Test basic functionality
 1. Merge develop changes into your branch, resolve any conflicts and retest
        + ```git commit -am 'COMMENT'```
        + ```git checkout develop```
        + ```git pull origin develop```
        + ```git checkout <your branch name>```
        + ```git merge develop```
        + Repeat the tests and make sure they pass
 1. Create Pull Request for your changes:
 	+ ```git push origin <your branch name>```
	+ In GitHub, click on [Pull Requests tab](https://github.com/rajatjain4061/real11-node/pulls)
	+ Click on New Pull Request
	+ Leave base as Develop, change compare to <your branch name>.
	+ Complete the form
	+ Add members of the core team as reviewers
	
### Merge Requests (Front End Development )
MR submission etiquette:
Provide 'before' and 'after' screenshots of changes that affect UX/UI.
Use [Recordit](http://recordit.co/) to create GIF screencasts for UX changes. Alternatively, Windows users can use [ScreenToGif](http://www.screentogif.com/).	

### Notes:
+ If you are working on major extended features, you may temporarily push your local branch to Github. Otherwise you should delete it after completing updates to avoid confusion.  
+ Pursuant to testing and supervision, your branch gets merged into rajatjain4061/real11-node::develop once your changes have been folded into develop your branch may be deleted.

### Troubleshooting
+ Periodically, it is helpful to run ```npm install ``` after ```git pull origin develop ``` to ensure latest 3rd party packages get installed locally.
+ If ```npm install ``` is showing errors, and certain modules are not getting installed (i.e. confirming from the error message that the module in question is in the "dependencies" field in the package.json file, but not in the node_modules subdirectory), one possibility would be updating npm itself via ```sudo npm install npm@latest -g``` and then re-running ```npm install```.
###my random changes

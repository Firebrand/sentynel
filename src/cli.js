import inquirer from 'inquirer';
import { initializeSentynel } from './main';
import { Command } from 'commander/esm.mjs';
import YAML from 'yaml';
import fs from 'fs';
import chalk from 'chalk';
import path from 'path';

function parseArgumentsIntoOptions(rawArgs) {

  const art = `                                        
  ((  ((    ((  ((     ((  ((    ((  (( 
  (( (((    (( (((     ((( ((    ((( (( 
    (%        (&         &(        %(   
    %%  %%    &&         &&    %%  %%   
    %%  %%    &&         &&    %%  %%   
    %%  %%    #############    %%  %%   
    %%  %% ################### %%  %%   
    %%   #####  ##     ##  #####   %%   
    %%  % ##################### %  %%   
    %%  %%   ###  #####  ###   %%  %%   
    %%  %%    #############    %%  %%   
    %%  %%    %%  %% %%  %%    %%  %%   
    %%  %%    %%  %% %%  %%    %%  %%   
    %%  %%%%%%%  %%   %%  %%%%%%%  %%   
     %%%       %%%     %%%       %%%    
        %%%%%%%           %%%%%%%       
                                        `
  console.log(chalk.bold.red(art));

  const program = new Command();

  program
  .option('-b, --build', 'Crawl site again and rebuild cache')
  .option('-d, --depth <depth>', 'Sets the depth level for the crawl')
  .option('-i, --diff', 'Run a diff on the discovered elements only')
  .option('-p, --pageDiff', 'Run a page-wide diff')
  .option('-c, --client', 'Crawl client-rendered websites(slower)')
  

  program.parse(rawArgs);
  const options = program.opts();



  return {
    depth: options['depth'] || 100,
    initialize: options['initialize'] || false,
    build: options['build'] || false,
    audit: options['diff'] || false,
    fullAudit: options['pageDiff'] || false,
  };
}

function copyYMLFiles() {
  var absoluteTemplatePath = path.resolve(__dirname + '/yml_templates');
  fs.copyFileSync(`${absoluteTemplatePath}/sentynel_settings.yml`, 'sentynel_settings.yml');
  fs.copyFileSync(`${absoluteTemplatePath}/sentynel_sites.yml`, 'sentynel_sites.yml');
  fs.copyFileSync(`${absoluteTemplatePath}/sentynel_selectors.yml`, 'sentynel_selectors.yml');
  fs.copyFileSync(`${absoluteTemplatePath}/sentynel_cache.yml`, 'sentynel_cache.yml');
}

async function promptForMissingOptions(options) {

  const questions = [];

  const sites = fs.readFileSync('./sentynel_sites.yml', 'utf8')
  const parsedSites = YAML.parse(sites)

  const selectors = fs.readFileSync('./sentynel_selectors.yml', 'utf8')
  const parseselectors = YAML.parse(selectors)



  if (!options.site) {
    questions.push({
      type: 'list',
      name: 'site',
      message: 'Select a site to crawl:',
      choices: Object.keys(parsedSites)
    });
  }

  if (!options.selector) {
    questions.push({
      type: 'list',
      name: 'selector',
      message: 'Select a component/element to find:',
      choices: Object.keys(parseselectors)
    });
  }
  
  const answers = await inquirer.prompt(questions);
  return {
    ...options,
    site: answers.site,
    siteUrl: parsedSites[answers.site]['url'],
    siteUrlComp: parsedSites[answers.site]['url_comp'] || false,
    selector: answers.selector,
    selectorVal: parseselectors[answers.selector]
  };
}

export async function cli(args) {
  let options = parseArgumentsIntoOptions(args);

  if (fs.existsSync('sentynel_sites.yml') && fs.existsSync('sentynel_selectors.yml') && fs.existsSync('sentynel_settings.yml')) {
    options = await promptForMissingOptions(options);

    const settings = fs.readFileSync('./sentynel_settings.yml', 'utf8')
    const parsedSettings = YAML.parse(settings)

    options['depth'] = options['depth'] || parsedSettings['depth'];
    options['proxy'] = parsedSettings['proxy'] || null;

    await initializeSentynel(options);
  } else {
    copyYMLFiles();
    console.log('Sentynel has create 4 yml files for you. You can now customize those and rerun Sentynel.');
  }

}



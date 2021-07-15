import YAML from 'yaml';
import fs from 'fs';
import puppeteer from 'puppeteer';
import mergeOptions from 'merge-options';
import request from 'superagent';
require('superagent-proxy')(request);
import path from 'path';
import open from 'open';
import cliProgress from 'cli-progress';
import chalk from 'chalk';
import {
    parseHTML
} from 'linkedom';
import {
    compare
} from 'odiff-bin';


const crawlIndex = [];
const SETTINGS = {
    assetDir: 'assets'
}
let listenerCount = 0;
let currentListenerCount = 0;
let crawlDepth;
let startBenchmark = 0;
let browser = null;
let options = {};
let snapshotIndex = {};
let heatmapIndex = {};
process.setMaxListeners(120);



export async function initializeSentynel(opts) {
    options = opts;
    if (options.build) {
        await initializeCrawl();
    } else {
        initializeSnaps();
    }
}

function readFromCache() {
    const cache = fs.readFileSync('./sentynel_cache.yml', 'utf8');
    return YAML.parse(cache);
}

function writeToCache(cacheArr) {
    const currentCache = readFromCache();
    if (currentCache) {
        fs.writeFileSync('./sentynel_cache.yml', YAML.stringify(mergeOptions(currentCache, cacheArr)));
    } else {
        fs.writeFileSync('./sentynel_cache.yml', YAML.stringify(cacheArr));
    }
}


export async function initializeCrawl() {

    var d = new Date();
    startBenchmark = d.getTime();

    crawlDepth = options.depth;

    const currentSiteAndElement = {
        [options.site]: {
            [options.selector]: {
                'date': new Date(),
                'sites': []
            }
        }
    }

    writeToCache(currentSiteAndElement);

    await crawlPage();
}



function createDirIfNotExists(dirName) {
    if (!fs.existsSync(dirName)) {
        fs.mkdirSync(dirName);
    }
}



export async function initializeSnaps() {

    browser = await puppeteer.launch();

    createDirIfNotExists(SETTINGS.assetDir);

    const cache = readFromCache();

    if (cache && cache[options.site] && cache[options.site][options.selector] && cache[options.site][options.selector]['sites']) {
        snapshotIndex = await snapPages(cache[options.site][options.selector]['sites']);
        
        await browser.close();

        if (options.fullAudit || options.audit) {
            heatmapIndex = await imageDiff();
        }

        await generateHtmlReport()

    } else {
        await initializeCrawl();
    }

}


const imageDiff = () => new Promise((resolve, reject) => {

    let promiseArr = [];
    let heatmapIndexRes = {}

    console.log(chalk `\n\n{yellow Starting diff analysis...}`);

    const bar2 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    bar2.start(Object.keys(snapshotIndex).length, 0);

    let sourceSuffix = options.fullAudit ? '_full.png' : '.png';
    let targetSuffix = '_comp.png';

    for (const snapshot in snapshotIndex) {

        const heatPromise = compare(
            SETTINGS.assetDir + '/' + snapshotIndex[snapshot] + sourceSuffix,
            SETTINGS.assetDir + '/' + snapshotIndex[snapshot] + targetSuffix,
            SETTINGS.assetDir + '/' + snapshotIndex[snapshot] + '_heat.png'
        );

        promiseArr = [...promiseArr, heatPromise.then(result => {
            bar2.increment();
            heatmapIndexRes[snapshot] = result
        })];
    }

    Promise.allSettled(promiseArr).then(() => {
        resolve(heatmapIndexRes)
    });
})


async function generateHtmlReport() {

    console.log(chalk `\n\n{yellow Generating html report...}`);

    var absolutePath = path.resolve(SETTINGS.assetDir);
    let imagesHtml = '';
    let counter = 1;

    for (const snapshot in snapshotIndex) {
        const imgSrc = path.normalize(`file://${absolutePath}/${snapshotIndex[snapshot]}.png`);
        const imgSrcMobile = path.normalize(`file://${absolutePath}/${snapshotIndex[snapshot]}_mob.png`);
        let audit = '';

        if (options.fullAudit || options.audit) {
            let imgSrcOrigin = options.fullAudit ? path.normalize(`file://${absolutePath}/${snapshotIndex[snapshot]}_full.png`) : imgSrc;
            const imgSrcHeat = path.normalize(`file://${absolutePath}/${snapshotIndex[snapshot]}_heat.png`);
            const imgSrcComp = path.normalize(`file://${absolutePath}/${snapshotIndex[snapshot]}_comp.png`);
            const diffSite = explodeUrl(options.siteUrlComp)[0] + explodeUrl(snapshot)[1];
            if (heatmapIndex[snapshot] && heatmapIndex[snapshot].match === true) {
                audit = `<h3 class="h3-diff-green">Diff with <a href="${diffSite}">${diffSite}</a> (Perfect match):</h3>
                <a href="${imgSrcOrigin}"><img src="${imgSrcOrigin}" class="heat"></img></a>
                <a href="${imgSrcComp}"><img src="${imgSrcComp}" class="heat"></img></a`
            } else {
                audit = `
                <h3 class="h3-diff">Diff with <a href="${diffSite}">${diffSite}</a> (${heatmapIndex[snapshot].diffCount} differences):</h3>
                <a href="${imgSrcOrigin}"><img src="${imgSrcOrigin}" class="heat"></img></a>
                <a href="${imgSrcHeat}"><img src="${imgSrcHeat}" class="heat"></img></a>
                <a href="${imgSrcComp}"><img src="${imgSrcComp}" class="heat"></img></a>`
            } 
        }


        imagesHtml +=
            `<div style="margin-bottom: 20px;">
            <a href="${snapshot}"><h2>${counter}. ${snapshot} </h2></a>
            <h3 class="h3-desktop">Desktop:</h3>
            <div style="margin-bottom: 20px;"><img src="${imgSrc}" class="desktop"></img></div>
            <h3 class="h3-mobile">Mobile:</h3>
            <div><img src="${imgSrcMobile}" class="mobile"></img></div>
            ${audit}
        </div>`;
        counter++;
    }

    var dateObj = new Date();
    var month = dateObj.getMonth() + 1; //months from 1-12
    var day = dateObj.getDate();
    var year = dateObj.getFullYear();
    var hours = dateObj.getHours();
    var minutes = dateObj.getMinutes();

    const newdate = year + "_" + month + "_" + day;

    const html = `<!DOCTYPE html>
    <html>
      <head>
        <mate charest="utf-8" />
        <title>${options.site} ${options.selector} Sentynel Report</title>
        <style> 
            body { font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial }
            h2 { width:100%; background-color: black; color: white; padding: 20px; box-sizing: border-box }
            h1 {margin-top: 0px; margin-bottom: 40px; margin-left: 10px;}
            .desktop { border:2px solid #000; }
            .mobile { border:2px dashed darkblue; }
            .heat { border:2px dotted red; width: 360px }
            .h3-diff {color: red; margin-top: 30px;}
            .h3-diff-green {color: green; margin-top: 30px;}
            .h3-desktop {color: black; margin-top: 30px;}
            .h3-mobile {color: blue; margin-top: 30px;}
        </style>
      </head>
      <body>
        <img src="https://raw.githubusercontent.com/Firebrand/sentynel/main/logo.png"/>
        <h1><span style="color: #2F4048">${options.site} > ${options.selector} (${month}/${day}/${year} ${hours}:${minutes})</span></h1>
        ${imagesHtml}
      </body>
    </html>`;


    const outputName = `${options.site}_${options.selector}_${newdate}.html`;

    fs.writeFileSync(outputName, html);

    await open(outputName);

    var d = new Date();
    const totalTime = d.getTime() - startBenchmark;
    console.log(chalk `\n\n{blue Completed in: ${totalTime} milliseconds }`);
}


async function snap(filename, siteUrl, width, height, fullPage = false) {

    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
    await page.setViewport({
        width: width,
        height: height
    });
    await page.setDefaultNavigationTimeout(0);
    await page.goto(siteUrl, {
        waitUntil: 'networkidle2'
    });

    if (fullPage) {
        await page.screenshot({
            'path': SETTINGS.assetDir + '/' + filename + '.png',
            fullPage: true
        });
    } else {
        //await page.waitForSelector(options.selectorVal);
        const element = await page.$(options.selectorVal);
        const box = await element.boundingBox(); 

        if (box) {
            let x = 0;
            let y = box['y'] - 200; 
            let w = width; 
            let h = box['height'] + 400; 
            await page.screenshot({
                'path': SETTINGS.assetDir + '/' + filename + '.png',
                'clip': {
                    'x': x,
                    'y': y,
                    'width': w,
                    'height': h
                }
            });
        }
    }

    await page.close();
}


function explodeUrl(fullUrl) {
    const domainExtractor = /^(?:https?:\/\/)?(?:[^@\/\n]+@)?(?:www\.)?([^:\/?\n]+)/igm;
    const domain = fullUrl.match(domainExtractor);
    const page = fullUrl.replace(domain, '');
    return [domain, page]
}



const snapPages = (siteUrls) => new Promise((resolve, reject) => {

    let promiseArr = [];

    const snapshotIndex = {};
    const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    const siteUrlCompDomain = explodeUrl(options.siteUrlComp)[0];
    let numSnapsPerURL = options.audit ? 3 : options.fullAudit ? 4 : 2;

    bar1.start(siteUrls.length * numSnapsPerURL, 0);

    for (const siteUrl of siteUrls) {
        let filename = options.selector.replace(/\W/g, '') + '_' + siteUrl.replace(/\W/g, '');
        snapshotIndex[siteUrl] = filename;

        promiseArr.push(snap(filename, siteUrl, 1366, 768).then(result => {
            bar1.increment();
        }));
        promiseArr.push(snap(filename + '_mob', siteUrl, 360, 640).then(result => {
            bar1.increment();
        }));

        if (options.audit) {
            
            promiseArr.push(snap(filename + '_comp', siteUrlCompDomain + explodeUrl(siteUrl)[1], 1366, 768).then(result => {
                bar1.increment();
            }));
        } else if (options.fullAudit) {
            promiseArr.push(snap(filename + '_full', siteUrl, 1366, 768, true).then(result => {
                bar1.increment();
            }));
            promiseArr.push(snap(filename + '_comp', siteUrlCompDomain + explodeUrl(siteUrl)[1], 1366, 768, true).then(result => {
                bar1.increment();
            }));
        }

    }

    Promise.allSettled(promiseArr).then(() => {
        resolve(snapshotIndex)
    });
})


async function crawlPage(siteUrl = options.siteUrl) {

    listenerCount++;
    currentListenerCount++;

    console.log(`Processing ${siteUrl}`)

    const domain = explodeUrl(siteUrl)[0];

    // Look for urls
    const regex = /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/g;
    
    try {
        const response = await request.get(siteUrl).proxy(options.proxy);
        

        const {
            document
        } = parseHTML(response.text);

        var selection = document.querySelector(options.selectorVal) !== null;
        if (selection) {
            const currentCacheObject = readFromCache();

            const currentSiteAndElement = {
                [options.site]: {
                    [options.selector]: {
                        'sites': [...currentCacheObject[options.site][options.selector]['sites'], siteUrl]
                    }
                }
            }

            writeToCache(currentSiteAndElement);
        }


        let m;
        while ((m = regex.exec(response.text)) !== null) {
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }

            let indexed = addToIndex(m[2])
            if (indexed && currentListenerCount < crawlDepth) {
                
                crawlPage(`${domain}/${indexed}`);
            }
        }

        listenerCount--;

        if (listenerCount === 1) {
            //console.log(crawlIndex);
            console.log(chalk `\n{yellow Crawl complete. Starting captures...}`);
            initializeSnaps();
        }
    } catch (e) {
        listenerCount--;
        //console.log('here'+listenerCount);
    }

}

function addToIndex(url) {
    url = url.replace(/^\/|\/$/g, '');
    if (url.length > 1 &&
        url[0] !== '#' &&
        url.indexOf('://') < 0 &&
        url.indexOf('javascript:') < 0 &&
        url.indexOf('mailto:') < 0 &&
        url.indexOf('tel:') < 0 &&
        url.indexOf('.pdf') < 0 &&
        url.indexOf('.mp3') < 0 &&
        url.indexOf('.mp4') < 0) {
        if (crawlIndex.indexOf(url) === -1) {
            crawlIndex.push(url);
            return url;
        } else {
            return false;
        }
    } else {
        return false;
    }
}
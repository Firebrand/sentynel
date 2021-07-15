![css-to-scss logo](https://raw.githubusercontent.com/Firebrand/goforth/main/logo.png)

# Sentynel
A CLI tool that crawls your site & produces a report with all snapshots of a specific element/component on that site, including diffs with a prod environment. **Perfect for simple & effective frontend QA.**

### Installation
```
npm install -g sentynel
```

### Usage
1. After installing, run **"sentynel"** in your terminal. This will create 4 boilerplate YML files in the current directory.
2. Modify the **"sentynel_sites.yml"** and **"sentynel_selectors.yml"** files to include the sites and selectors you want Sentynel to capture.
3. Rerun **"sentynel"**
4. When it prompts you for it, choose a site and then a selector (the options come from the files in Step 2)
5. Sentynel will crawl through that site, take snapshots of those selectors wherever they appear and then generate a report.

#### Optional (and very cool):
You can add the -i or -p flags to the **sentynel** command to also run a diff between the generated snapshots of your page elements(above) and a version of those elements on a different domain (defined by **url_comp** in the sentynel_sites.yml file). This is great for comparison between dev and prod environments.

### Examples of use
Crawl through a site but only 10 links deep (faster):
```
sentynel -d 10
```
Rebuild the cache for a specific site/element combo (Sentynel caches the site/element choices for efficiency)
```
sentynel -b
```
Crawl through a site, snap element wherever it appears and then compare those results to a prod version of the site (defined by **url_comp** in the sentynel_sites.yml file)
```
sentynel -i
```
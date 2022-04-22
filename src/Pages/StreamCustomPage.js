const chalk = require("chalk");
const {delay} = require("../functions/util");
const data = require("../Data/SavedData");
const inputReader = require("wait-console-input");
const {secondstominutescalc} = require("../functions/util");
const {checkstatus} = require("../functions/CustomChannel");
const winston = require("winston");

let watchingpage;
async function StreamCustomPage(startch) {
    let starturl;
    let time;
    let WatchType;
    t = 0;

    data.CustomChannels.forEach(item => {
        if (item.Name === startch) {
            starturl = item.TTVLink;
            time = item.Time;
            WatchType = item.WatchType;
        } else if (item.TTVLink === startch) {
            starturl = item.TTVLink;
            time = item.Time;
            WatchType = item.WatchType;
        }
    })

    if (starturl === undefined) {
        winston.info(" ")
        winston.info(chalk.red("Did not found this Channel exiting..."))
        winston.info(" ")
        if (!data.displayless) inputReader.wait(chalk.gray("Press any Key to continue..."))
        process.exit(51)
    }

    //Open New Tab to the Starting ch
    winston.info(" ")
    winston.info(chalk.gray("Going to Starting Channel..."))
    //Open Watching Tab
    watchingpage = await data.browser.newPage();
    await watchingpage.setDefaultTimeout(data.settings.timeout)
    //Set Cookies
    await watchingpage.setCookie.apply(watchingpage, data.cookies);
    //Goto Selectetd Starting Ch
    await watchingpage.goto(starturl)
    //Check for 18+
    winston.info(" ")
    winston.info(chalk.gray("Setting Video Settings like Quality and Volume..."))
    //Set Settings
    await watchingpage.setViewport({ width: 1280, height: 720 })
    await watchingpage.reload({
        waitUntil: ["networkidle2", "domcontentloaded"]
    })
    await watchingpage.bringToFront();

    winston.info(" ")
    winston.info(chalk.magenta("Watching " + chalk.cyan(starturl.toString() + "...") ))
    winston.info(" ")

    //Start CurrentProgress Event
    await CurrentProgressEvent(WatchType, time, starturl, watchingpage);
}

//CurrentProgressEvent
let retry = 0;
let timeinseconds = 0;
let t = 0;

async function CurrentProgressEvent(WatchType, time, starturl, page) {
    await delay(60000).then(async () => {
        await checkstatus(false, false).then(async r => {
            let currenturlstatus = "";
            let onlinechs = [];
            let offlinechs = [];
            let pointi;

            r.forEach(item => {
                if (item.TTVLink === starturl) {
                    currenturlstatus = item.Status;
                }
                if (item.Status === "Online") {
                    if (item.TTVLink !==  starturl) {
                        onlinechs.push(item.TTVLink);
                    }
                } else {
                    offlinechs.push(item.TTVLink);
                }
            })

            data.CustomChannels.forEach(r => {
                if (r.TTVLink === starturl) {
                    pointi = r.Points;
                }
            })
            await farmpoint(page).then(async points => {
                if (currenturlstatus === "Online") {
                    if (WatchType === "Changed") {
                        timeinseconds = timeinseconds + 60;
                        winston.info(chalk.gray("Current Progress: ") + chalk.white("-" + " %") + chalk.gray(" | Watching since: " + secondstominutescalc(timeinseconds, true)) + await pointscheck(points.Points, points.Bonus, pointi));
                        return await CurrentProgressEvent(WatchType, time, starturl, page)
                    } else {
                        let timeleftinminutes = time;
                        let timeleft = timeleftinminutes - 1;

                        if (timeleftinminutes > 0) {
                            winston.info(chalk.gray("Current Progress: ") + chalk.white("-" + " %") + chalk.gray(" | " + secondstominutescalc(timeleftinminutes, false)) + await pointscheck(points.Points, points.Bonus, pointi));
                            return await CurrentProgressEvent(WatchType, timeleft, starturl, page)
                        } else {
                            if (t === 0) {
                                winston.info(" ");
                                winston.info(chalk.gray("Finished Watching Custom Channel looking for new Custom Channel..."));
                                t++
                            }

                            if (onlinechs.length === 0) {
                                winston.info(" ");
                                winston.info(chalk.gray("No other Online Custom Channels found waiting for new Channels to go Online..."));
                                await delay(540000).then(async () => {
                                    return CurrentProgressEvent(WatchType, time, starturl, page)
                                })
                            } else {
                                winston.info(" ");
                                winston.info(chalk.gray("Found other Channel..."));

                                const randomurl = onlinechs[Math.floor(Math.random() * onlinechs.length)];

                                winston.info(" ");
                                winston.info(chalk.magenta("Starting to Watch " + chalk.cyan(randomurl.toString() + "...")));

                                return StreamCustomPage(randomurl.toString());
                            }
                        }
                    }
                } else {
                    winston.info(" ");
                    winston.info(chalk.gray("Current Channel is Offline, looking for new one..."));

                    if (onlinechs.length === 0) {
                        winston.info(" ");
                        winston.info(chalk.gray("No other Online Custom Channels found waiting for new Channels to go Online..."));

                        await delay(540000).then(async () => {
                            return CurrentProgressEvent(WatchType, time, starturl, page)
                        })
                    } else {
                        winston.info(" ");
                        winston.info(chalk.gray("Found other Channel..."));

                        const randomurl = onlinechs[Math.floor(Math.random() * onlinechs.length)];

                        winston.info(" ");
                        winston.info(chalk.gray("Starting to Watch " + randomurl.toString() + "..."));

                        return StreamCustomPage(randomurl);
                    }
                }
            })
        })
    })
}
async function pointscheck(points, status, onoff) {
    function bonus(status) {
        if (status) {
            return "claimed"
        } else {
            return "pending"
        }
    }
    if (onoff) {
        if (status) {
            return chalk.gray(" | Points: " + chalk.white(points) + " | Bonus: " + chalk.white(bonus(status)));
        } else {
            return chalk.gray(" | Points: " + chalk.white(points) + " | Bonus: " + chalk.white(bonus(status)));
        }
    } else {
        return " "
    }
}

async function farmpoint(page) {
    //Inject JQuery
    await page.addScriptTag({url: 'https://code.jquery.com/jquery-3.6.0.js'})
    if (data.debug) winston.info(chalk.gray("Waiting for WatchingPage to load (WaitForSelector)"));
    try {await page.waitForSelector('[data-test-selector="balance-string"]', {visible: true});} catch (e) {winston.info(chalk.yellow('WARNING: Points Balance not loaded...'))}
    return await page.evaluate(() => {
        let rawPoints = $('[data-test-selector="balance-string"]').text()
        let communitybuttons = $('[data-test-selector="community-points-summary"]').find("button")

        if (communitybuttons.length === 2) {
            communitybuttons[1].click()
            return {Points: rawPoints, Bonus: true}
        } else {
            return {Points: rawPoints, Bonus: false}
        }
    })
}
module.exports = {
    StreamCustomPage
}


//Todo
//- Check ob alle chs bereits angeschaut wurden...
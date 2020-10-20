const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs')
const path = require('path')

axios.get('https://yts.mx/browse-movies?page=2')
    .then(res => {
        const movies = [];
        const $ = cheerio.load(res.data);
        $('.browse-movie-wrap').each((index, element) => {
            const pagesLinks = $(element).children('a').attr('href');
            movies[index] = pagesLinks;
        });
        insideLinks(movies);
    });

const insideLinks = async (links) => {
    let allMoviesContent = [];
    let torrentAllInfo = [];
    let reviews = [];
    let screenshotimgs = [];
    let i = 0;
    //for (a of links) {
    let pagesLink = links;
    await axios.get(pagesLink[1])
        .then(res => {
            torrentAllInfo = [];
            reviews = [];
            screenshotimgs = [];
            const $pageData = cheerio.load(res.data);
            const title = $pageData('#movie-info .hidden-xs h1').html();
            const moviesDate = $pageData('#movie-info .hidden-xs').children('h2').html();
            const categories = $pageData('#movie-info .hidden-xs').children('h2:nth-child(3)').html();
            const content = $pageData('#synopsis .hidden-xs').html();
            const moviePoster = $pageData('#movie-poster .img-responsive').attr('src');
            $pageData('.rating-row span:nth-child(2)').each((i, el) => {
                reviews.push($pageData(el).html());
            });
            $pageData('#movie-info .hidden-sm a').each((index, element) => {
                let torrentFile = $pageData(element).attr('href');
                let torrentTitle = $pageData(element).attr('title');
                let torrentLabel = $pageData(element).html();
                let torrentObj = {
                    torrentFile,
                    torrentTitle,
                    torrentLabel
                }
                torrentAllInfo.push(torrentObj);
            });
            $pageData('#screenshots .screenshot .screenshot-group img').each((index, element) => {
                let screenshot = $pageData(element).attr('src');
                screenshotimgs.push(screenshot);
            });
            let url = $pageData('#playTrailer').attr('href');
            let movieTrailerID;
            url = url.replace(/(>|<)/gi, '').split(/(vi\/|v=|\/v\/|youtu\.be\/|\/embed\/)/);
            if (url[2] !== undefined) {
                movieTrailerID = url[2].split(/[^0-9a-z_\-]/i);
                movieTrailerID = movieTrailerID[0];
            }
            else {
                movieTrailerID = 'eDtksqj0v9k';
            }
            let moviesDateFormat = moviesDate.split(" ");
            let categoriesArr = categories.split("/");
            allMoviesContent.push({
                title,
                content,
                moviePoster,
                movieTrailerID,
                moviesDateFormat: moviesDateFormat[0],
                categoriesArr,
                torrentAllInfo,
                reviews,
                screenshotimgs
            });
        });
    i++;
    //}
    insertData(allMoviesContent);
}

const insertData = async (allmovies) => {
    for (let movie in allmovies) {
        let moviesInsertCats;
        let imgNamePath;
        let getAllscreenshotimgs;
        getAllCategories(allmovies[movie].categoriesArr)
            .then((catsArr) => {
                moviesInsertCats = catsArr;
                downloadImage(allmovies[movie].moviePoster, allmovies[movie].title)
                    .then(imgName => {
                        imgNamePath = imgName;
                        downloadScreenshotimgs(allmovies[movie].screenshotimgs, allmovies[movie].title)
                            .then(screenshotimgs => {
                                getAllscreenshotimgs = screenshotimgs;
                                downloadTorrentFiles(allmovies[movie].torrentAllInfo, allmovies[movie].title, allmovies[movie].moviesDateFormat)
                                    .then(torrentArrObj => {
                                        insertMovieData(imgNamePath, allmovies[movie].content, allmovies[movie].title, allmovies[movie].movieTrailerID, allmovies[movie].moviesDateFormat, moviesInsertCats, torrentArrObj, allmovies[movie].reviews, getAllscreenshotimgs);
                                    });
                            })
                    });
            });
    }
}


async function downloadScreenshotimgs(screenshotimages, title) {
    let screenshotimgs = [];
    for (img in screenshotimages) {
        if (screenshotimages[img]) {
            let screenshotNameExtension = screenshotimages[img].substring(screenshotimages[img].lastIndexOf('.') + 1, screenshotimages[img].length);
            let url = screenshotimages[img];
            title = title.toLowerCase();
            let screenshotName = title.replace(/\s|[0-9_]|\W|[#$%^&*()]/g, "") + Math.floor((Math.random() * 100) + 1);
            let imagefile = path.resolve(__dirname, '../public/uploads/screenshotimgs', `${screenshotName}.${screenshotNameExtension}`);
            let writerImg = fs.createWriteStream(imagefile);
            const response = await axios({
                url,
                method: 'GET',
                responseType: 'stream'
            }).then(response => {
                response.data.pipe(writerImg);
            }).catch(err => {
                moviePosterName = 'defaultImage';
            });
            let imgObj = {
                imageName: `${screenshotName}.${screenshotNameExtension}`
            }
            console.log(imgObj);
            screenshotimgs.push(imgObj);
        }
    }
    //console.log(screenshotimgs);
    return JSON.stringify(screenshotimgs);
}

async function downloadImage(moviePoster, title) {
    let moviePosterExtension = moviePoster.substring(moviePoster.lastIndexOf('.') + 1, moviePoster.length);
    let url = moviePoster;
    title = title.toLowerCase();
    let moviePosterName = title.replace(/\s|[0-9_]|\W|[#$%^&*()]/g, "") + Math.floor((Math.random() * 100) + 1);
    let imagefile = path.resolve(__dirname, '../public/uploads/images', `${moviePosterName}.${moviePosterExtension}`);
    let writerImg = fs.createWriteStream(imagefile);
    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        }).then(response => {
            response.data.pipe(writerImg);
        }).catch(err => {
            moviePosterName = 'defaultImage';
        });
        return `${moviePosterName}.${moviePosterExtension}`;
    }
    catch (err) {
        console.log(err);
    }
}


async function downloadTorrentFiles(movieTorrent, title, moviesDateFormat) {
    let torrentArrObj = [];
    for (torrentFile in movieTorrent) {
        if (movieTorrent[torrentFile].torrentTitle.indexOf("subtitles") == -1) {
            let movieTorrentExtension = 'torrent'
            let url = movieTorrent[torrentFile].torrentFile;
            let torrentTitle = movieTorrent[torrentFile].torrentTitle;
            let torrentLabel = movieTorrent[torrentFile].torrentLabel;
            title = title.toLowerCase()
            let torrentLabelFile = torrentLabel.replace(/\s|\W|[#$%^&*()]/g, "_");
            let movieTorrentName = title.replace(/\s|[0-9_]|\W|[#$%^&*()]/g, "_");
            let movieTorrentNameModified = `${movieTorrentName}_${torrentLabelFile}_${moviesDateFormat}_` + Math.floor((Math.random() * 100) + 1);
            let torrentfilePath = path.resolve(__dirname, '../public/uploads/torrentsfiles', `${movieTorrentNameModified}.${movieTorrentExtension}`);
            let torrentFileFinalPath = fs.createWriteStream(torrentfilePath);
            const response = await axios({
                url,
                method: 'get',
                responseType: 'stream'
            });
            response.data.pipe(torrentFileFinalPath);
            let torrentObj = {
                movieTorrentFile: `${movieTorrentNameModified}.${movieTorrentExtension}`,
                torrentTitle,
                torrentLabel
            }
            torrentArrObj.push(torrentObj);
        }
    }
    return JSON.stringify(torrentArrObj);
}

async function insertMovieData(imageName, content, title, movieTrailerID, moviesDateFormat, moviesInsertCats, torrentArrObjCooked, reviews, screenshotimgs) {
    let moviesInsertCatIntoArr = moviesInsertCats.split(',');
    let showData = {
        'title': title,
        'description': content,
        'poster': imageName,
        'publish': true,
        'categories': moviesInsertCatIntoArr,
        'trailer': movieTrailerID,
        'date': moviesDateFormat,
        'torrentData': torrentArrObjCooked,
        'critics': reviews[1],
        'audience': reviews[2],
        'imdb': reviews[3],
        'Screenshotimgs': screenshotimgs
    }
    console.log(showData);
    // const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjVmNzBkNzcyMTAzNTk1NDU1ODNiYWViZCIsImlhdCI6MTYwMjAwMTc2MywiZXhwIjoxNjA0NTkzNzYzfQ.7B9pHkSGoGkQHRqOoUYpfVVguga5LpRzU_eXoCwZ-FI";
    // const submitPost = await axios.post('http://localhost:1337/movies', showData, {
    //     headers: {
    //         'Authorization': `Bearer ${token}`
    //     }
    // });
}

async function getAllCategories(allCat) {
    var allCategoriesinWP = new Map();
    let catsArr = [];
    await axios.get('http://localhost:1337/categories')
        .then(res => {
            for (catdIDandName in res.data) {
                allCategoriesinWP.set(res.data[catdIDandName].category, res.data[catdIDandName].id);
            }
        }).then(() => {
            for (catIndex in allCat) {
                let smallCat = allCat[catIndex].toLowerCase().replace(/\s/g, '');
                if (allCategoriesinWP.get(smallCat)) {
                    catsArr.push(`${allCategoriesinWP.get(smallCat)}`);
                };
            }
        });
    return catsArr.toString();
}
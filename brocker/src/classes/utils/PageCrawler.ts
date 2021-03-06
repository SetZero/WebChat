import LRUCache, {Options} from "lru-cache";
import { Url } from "url";
import request, {} from "request";
import Queue from "better-queue";
import htmlparser2 from "htmlparser2"
import * as url from "url";

const fetchVideoInfo = require('youtube-info');

class PageInfo {
    title: string = "";
    description: string = "";
    image: Url = {};
    link: Url = {};
    hasContent: boolean = false;

	constructor(title?: string, description?: string, image?: Url, link?: Url) {
        if(title) this.title = title;
        if(description) this.description = description;
        if(image) this.image = image;
        if(link) this.link = link;
        if(title && image && link) this.hasContent = true;
	}
}

enum LinkInfo {
    Ok,
    LinkNotFound,
    GeneralError
}

export class PageCrawler {
    private cache: LRUCache<string, PageInfo>;
    private requestQueue: Queue<Url, PageInfo> = new Queue((input, cb) => { this.processPage(input, cb); });

    constructor() {
        const option: Options<string, PageInfo> = {};
        option.max = 50;
        option.maxAge = 1000 * 60 * 60;
        //option.length = (n, key) => { return n.length * 2 + key.length; }
        //option.dispose = (key, n) => {}
        this.cache = new LRUCache(option);
    }

    getWebpage(page: Url, callback: (info: PageInfo) => void) {
        console.log("Process page...");

        const pageInfo = this.cache.get(page.href ?? "");
        if(!pageInfo) {
            this.requestQueue
            .push(page)
            .on("finish", (result) => { callback(result) });
        } else if(pageInfo.hasContent) {
            callback(pageInfo);
        }
    }

    private processPage(input: Url, cb: Queue.ProcessFunctionCb<PageInfo>) {
        console.log("Request: %s", input.href);

        switch(input.hostname) {
            case "www.youtube.com":
                this.handleYoutube(input, (info) => {
                    this.cache.set(input.href ?? "", info);
                    cb(null, info);
                });
                break;
            default:
                this.handleGenericPage(input, (status, info) => {
                    if(status === LinkInfo.Ok && info) {
                        this.cache.set(input.href ?? "", info);
                        cb(null, info);
                    } else {
                        this.cache.set(input.href ?? "", new PageInfo());
                        cb(status, undefined);
                    }
                });
        }

    }
    handleGenericPage(input: Url, cb: (status: LinkInfo, info?: PageInfo) => void) {
        if(!input.href) return;
        request(input.href, (error, response, body) => {
            if(error) cb(LinkInfo.GeneralError);
            let title = "";
            let description = "";
            let thumbnailUrl = "";
            let pageUrl = "";

            const parser = new htmlparser2.Parser({
                onopentag(name, attribs) {
                    if(name === "meta") {
                        if(attribs.property) {
                            switch(attribs.property.trim()) {
                                case "og:title":
                                    title = attribs.content;
                                    break;
                                case "og:description":
                                    description = attribs.content;
                                    break;
                                case "og:image":
                                    thumbnailUrl = attribs.content;
                                    break;
                                case "og:url":
                                    pageUrl = attribs.content;
                                    break;
                                default:
                                    break;
                            }
                        }

                        if(attribs.itemprop) {
                            switch(attribs.itemprop.trim()) {
                                case "headline":
                                    title = attribs.content;
                                    break;
                                default:
                                    break;
                            }
                        }
                    }
                }
            });
            parser.write(body);
            parser.end();
            if(pageUrl === "") pageUrl = input.href ?? "";
            console.log("%s | %s | %s", pageUrl, title, thumbnailUrl)
            if(pageUrl !== "" && title !== "" && thumbnailUrl !== "") {
                cb(LinkInfo.Ok, new PageInfo(title, description, url.parse(thumbnailUrl), url.parse(pageUrl)));
            } else {
                cb(LinkInfo.LinkNotFound);
            }
        });
    }
    handleYoutube(input: Url, cb: (info: PageInfo) => void) {
        const query = input.query as any;
        if(query) {
            console.log("Query!");
            fetchVideoInfo(query.v, (err: any, videoInfo: any) => {
                if(videoInfo) {
                    cb(new PageInfo(videoInfo.title, videoInfo.description, url.parse(videoInfo.thumbnailUrl), url.parse(videoInfo.url)));
                }
            });
        }
    }
}
import React from "react";
import { SyntaxHighlighter } from "./SyntaxHighlighter";
import DOMPurify from "dompurify";
import { WebSocketClient } from "../../classes/WebSocketClient";

export class ChatMessageParser {
    private static readonly codeBlock: RegExp = /(```([A-Za-z]+)?\n?(.*?)\n?```)/;
    private helperConnection: WebSocketClient<string> | undefined;
    private eventMap = new Map<number, HTMLElement>();

    /**
     * Getter $helperConnection
     * @return {WebSocketClient<string>}
     */
	public get $helperConnection(): WebSocketClient<string> | undefined {
		return this.helperConnection;
    }

    public set $helperConnection(value: WebSocketClient<string> | undefined)  {
        this.helperConnection = value;
        this.helperConnection?.addMessageListener((data) => {
            const message = JSON.parse(data as string);
            if(message.messageType === "error") {
                console.error(message.payload)
                return;
            }
            const element = this.eventMap.get(message.timestamp);
            this.eventMap.delete(message.timestamp);
            const link: HTMLAnchorElement = document.createElement("a");
            link.setAttribute("href", message.payload);
            link.setAttribute("target", "_blank");
            const img: HTMLImageElement = document.createElement("img");
            img.setAttribute("src", message.payload);
            link.appendChild(img);
            link.append("(Image)");
            element?.appendChild(link);

            console.log(message.payload);
        })
    }

    parse(message: string) {
        var tmp = document.createElement("DIV");
        tmp.innerHTML = DOMPurify.sanitize(message);
        this.improveLinks(tmp);
        const stripped = tmp.textContent || tmp.innerText || "";

        const plainmessage = stripped;
        const match = plainmessage.match(ChatMessageParser.codeBlock);
        if(match !== null && match.length > 3) {
            const language = match[2];
            const content = match[3];
            let replace = (<SyntaxHighlighter lang={language}>{content}</SyntaxHighlighter>);
            return replace;
        }
        return ((<p dangerouslySetInnerHTML={{__html: tmp.innerHTML}}></p>));
    }

    pasteListener(event: React.ClipboardEvent<HTMLDivElement>, self: ChatMessageParser) {
        event.persist();
        if(event.clipboardData.files.length > 0 && !event.clipboardData.types.includes("text/html")) {
            event.preventDefault();
            Array.from(event.clipboardData.files).forEach((file) => {
                var reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => {
                    const date = Date.now();
                    self.helperConnection?.sendMessage(JSON.stringify({messageType: "image",
                                                                        host: window.location.hostname,
                                                                        protocol: window.location.protocol,
                                                                        type: file.type,
                                                                        payload: reader.result,
                                                                        timestamp: date}));
                    self.eventMap.set(date, event.target as HTMLElement);
                }
            });
        }
    /*if(event.clipboardData.types.includes("text/plain")) {
        const element = event.clipboardData.getData("text/plain");
        (event.currentTarget as HTMLDivElement).nodeValue = element;
        event.preventDefault();
    }*/
    }

    private improveLinks(dom: HTMLElement) {
    const links = dom.getElementsByTagName("a");
    Array.from(links).forEach(element => {
        element.setAttribute("target", "_blank");
    });
    }
}
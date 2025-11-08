'use client'

import { useState, useEffect, useRef } from "react";
import InputBox from "./inputbox";
import MarkdownRenderer from "./markdown-render";

interface Message {
    content: string;
    type: 'user' | 'response';
}

export default function ChatBar(){
    const [messages, setMessages] = useState<Message[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const handleSendMessage = (message: string) => {
        setMessages((prev) => [
            ...prev, 
            { content: message, type: 'user' },
            { content: "# Hello, Markdown!\n\nThis is **bold**, *italic*, and a [link](https://example.com).", type: 'response' }
        ]);
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className="h-full w-full bg-[#1D1D1D] pr-2 text-white flex flex-col">
            <div className="grow overflow-auto p-4 space-y-4">
                {messages.map((message, index) => (
                    message.type === 'user' ? (
                        <div 
                            key={index}
                            className="flex justify-end"
                        >
                            <div className="bg-[#282825] rounded-2xl p-4 text-white max-w-[80%]">
                                <MarkdownRenderer markdown={message.content} />
                            </div>
                        </div>
                    ) : (
                        <div 
                            key={index}
                            className="flex justify-start"
                        >
                            <div className="text-gray-300 p-4 max-w-[80%]">
                                <MarkdownRenderer markdown={message.content} />
                            </div>
                        </div>
                    )
                ))}
                <div ref={messagesEndRef} />
            </div>
            <div className="shrink-0 p-2">
                <InputBox onSendMessage={handleSendMessage} />
            </div>
        </div>
    )
}
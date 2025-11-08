export default function ChatBar(){
    return (
        <div className="h-full w-full bg-[#1D1D1D] pr-2 text-white flex flex-col">
            <div className="grow overflow-auto">

            </div>
            <div className="h-[12%] bg-[#282825] rounded-3xl">
                <input
                    type="text"
                    placeholder="Type your message..."
                    className="flex-1 bg-transparent outline-none text-white placeholder-gray-400 px-3 py-3 text-base"
                />
                <button className="ml-3 bg-[#3a3a36] hover:bg-[#454542] text-white px-4 py-2 rounded-2xl transition-all">
                    Send
                </button>
            </div>
        </div>
    )
}
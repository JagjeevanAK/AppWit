import InputBox from "@/components/inputbox";
import AnimatedBackground from "@/components/animated-background";

export default function Home(){
    return (
        <div className="relative flex items-center h-screen justify-center flex-col text-white">
            <AnimatedBackground />
            <div className="mb-15 z-10">
                <div className="m-4 text-4xl font-bold text-center">
                    Build something with VerSim
                </div>
                <div className="m-4 text-xl text-center opacity-90">
                    Create apps and websites by chatting with AI
                </div>
            </div>
            <div className="z-10">
                <InputBox 
                    width="800px" 
                    height="auto" 
                    maxHeight="300px"
                    animatedPlaceholder={true}
                />
            </div>
        </div>
    )
}
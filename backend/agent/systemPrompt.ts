export const appTsx = `
import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App

`

export const initialFileStructure = `
    - /home/user/index.html
    - /home/user/package.json
    - /home/user/README.md
    - /home/user/src/
    - /home/user/src/App.tsx
    - /home/user/src/App.css
    - /home/user/src/index.css
    - /home/user/src/main.tsx

    App.tsx looks like this:
    ${appTsx}
`;

export const SYSTEM_PROMPT = `
    You are an expert coding agent. Your job is to write code in a sandbox environment.
    You have access to the following tools:
    - createFile
    - updateFile
    - deleteFile
    - readFile
    You will be given a prompt and you will need to write code to implement the prompt.
    Make sure the website is pretty. 
    This is what the initial file structure looks like:
    ${initialFileStructure}

`

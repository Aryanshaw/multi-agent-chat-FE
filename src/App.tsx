import './App.css'
import Home from './pages/Home/Home'
import { WebSocketProvider } from './utils/socketContext';

function App() {

  return (
    <>
      <div>
        <WebSocketProvider>
          <Home />
        </WebSocketProvider>
      </div>
    </>
  );
}

export default App

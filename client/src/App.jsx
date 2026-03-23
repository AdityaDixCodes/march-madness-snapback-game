import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Setup from './pages/Setup'
import Game from './pages/Game'
import Lobby from './pages/Lobby'
import MultiSetup from './pages/MultiSetup'
import ModePick from './pages/ModePick'
import MultiPlay from './pages/MultiPlay'
import './App.css'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/game" element={<Game />} />
      <Route path="/lobby" element={<Lobby />} />
      <Route path="/multisetup" element={<MultiSetup />} />
      <Route path="/modepick" element={<ModePick />} />
      <Route path="/multiplay" element={<MultiPlay />} />
    </Routes>
  )
}
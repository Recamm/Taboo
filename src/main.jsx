import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class ErrorBoundary extends React.Component {
  state = {failed:false};
  static getDerivedStateFromError() {return {failed:true};}
  render() {
    if(this.state.failed)return <div className="loading"><h1>No pudimos abrir el juego.</h1><p>Recargá la página para volver a intentar. Si el problema sigue, borrá la partida guardada.</p><button className="secondary" onClick={()=>{try{localStorage.removeItem('palabras-prohibidas:game');}catch{}location.reload();}}>Reiniciar partida guardada</button></div>;
    return this.props.children;
  }
}
createRoot(document.getElementById('root')).render(<ErrorBoundary><App/></ErrorBoundary>);

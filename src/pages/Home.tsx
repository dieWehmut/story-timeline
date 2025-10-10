import React from 'react';
import NavbarLinks from '../components/NavbarLinks';
import MusicTable from '../components/MusicTable';
import Footer from '../components/Footer';
import '../styles/Home.css';

const Home: React.FC = () => {
  return (
    <div className="home">
      <NavbarLinks />
      <MusicTable />
      <Footer />
    </div>
  );
};

export default Home;

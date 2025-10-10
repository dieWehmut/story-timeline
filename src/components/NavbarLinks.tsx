import React, { useState, useEffect } from 'react';
import { getLinks, type Link } from '../lib/links';
import '../styles/NavbarLinks.css';

const NavbarLinks: React.FC = () => {
  const [links, setLinks] = useState<Link[]>([]);

  useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = async () => {
    const data = await getLinks();
    setLinks(data);
  };

  return (
    <div className="navbar-links">
      {links.map((link, index) => (
        <div key={link.id} className="link-item">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="link-title"
            title={link.url}
          >
            <span className="link-index">{index + 1}</span>
            <span className="link-text">{link.title}</span>
          </a>
        </div>
      ))}

      {links.length === 0 && (
        <div className="empty-links">暂无链接</div>
      )}
    </div>
  );
};

export default NavbarLinks;

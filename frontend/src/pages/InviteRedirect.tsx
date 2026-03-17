import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export default function InviteRedirect() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (code) {
      sessionStorage.setItem('invite_code', code);
    }
    navigate('/register', { replace: true });
  }, [code, navigate]);

  return null;
}

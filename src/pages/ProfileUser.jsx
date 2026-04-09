import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { Eye, Star } from 'lucide-react';
import { apiClient, getImageUrl } from '../utils/api';

const ProfileUser = () => {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      if (!username) return;
      setLoading(true);
      setError('');
      try {
        const result = await apiClient.getUserProfile(username);
        if (result?.status && result?.data) {
          setProfile(result.data);
        } else {
          setError('Profil tidak ditemukan');
        }
      } catch (err) {
        setError(err.message || 'Gagal memuat profil');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [username]);

  const membershipDate = useMemo(() => {
    if (!profile?.membership_expires_at) return null;
    const date = new Date(profile.membership_expires_at);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }, [profile?.membership_expires_at]);

  if (loading) {
    return (
      <div className="min-h-screen bg-primary-950 text-white flex items-center justify-center">
        <p className="text-gray-300">Memuat profil...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-primary-950 text-white flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-300 mb-4">{error || 'Profil tidak ditemukan'}</p>
          <Link
            to="/"
            className="inline-block px-4 py-2 rounded-lg bg-primary-700 hover:bg-primary-600 transition-colors"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    );
  }

  const photo = getImageUrl(profile.profile_image);

  return (
    <div className="min-h-screen bg-primary-950 text-white">
      <Helmet>
        <title>{`${profile.name} (@${profile.username}) | KomikNesia`}</title>
        <meta
          name="description"
          content={profile.bio || `Lihat profil ${profile.name} di KomikNesia.`}
        />
      </Helmet>

      <main className="px-4 py-10 md:py-16">
        <div className="max-w-5xl mx-auto">
          <div className="relative h-[300px] md:h-[360px] rounded-2xl overflow-hidden mb-6">
            <div
              className="absolute inset-0 bg-cover bg-center blur-xl scale-110"
              style={{ backgroundImage: `url(${photo || '/logo.png'})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary-950 via-primary-950/70 to-primary-950/20" />
            <div className="relative h-full flex items-end p-6 md:p-8">
              <div className="flex items-end gap-5 w-full">
                <div className="shrink-0 w-28 h-36 md:w-36 md:h-48 rounded-xl overflow-hidden bg-primary-800 border border-primary-700">
                  {photo ? (
                    <img src={photo} alt={profile.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl font-bold">
                      {String(profile.name || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 pb-1">
                  <h1 className="text-3xl md:text-5xl font-bold leading-tight">{profile.name}</h1>
                  <p className="text-gray-300 mt-1">@{profile.username}</p>
                  <div className="flex flex-wrap items-center gap-4 mt-3 text-gray-200">
                    <div className="flex items-center gap-1.5">
                      <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                      <span>{profile.points?.toLocaleString('id-ID') || '0'} poin</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Eye className="h-4 w-4 text-green-400" />
                      <span>{profile.membership_active ? 'Premium aktif' : 'Member reguler'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-primary-900 rounded-xl p-5 md:p-6 mb-5">
            <p className="text-gray-200 leading-relaxed">
              {profile.bio || 'Pengguna ini belum menambahkan bio.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {profile.membership_active && (
              <div className="px-4 py-2 bg-amber-900/30 rounded-lg text-amber-200 text-sm">
                Premium Member
                {membershipDate ? ` - aktif sampai ${membershipDate}` : ''}
              </div>
            )}
            {!profile.membership_active && (
              <div className="px-4 py-2 bg-primary-800 rounded-lg text-gray-300 text-sm">
                Belum premium
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProfileUser;

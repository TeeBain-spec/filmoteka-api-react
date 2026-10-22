import { Route, Routes } from 'react-router-dom'
import NavBar from './components/NavBar.jsx'
import Flash from './components/Flash.jsx'
import MovieListPage from './pages/MovieListPage.jsx'
import MovieFormPage from './pages/MovieFormPage.jsx'
import SearchPage from './pages/SearchPage.jsx'
import MovieDetailsPage from './pages/MovieDetailsPage.jsx'
import GenresPage from './pages/GenresPage.jsx'
import StatsPage from './pages/StatsPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

export default function App() {
  return (
    <>
      <NavBar />
      <main className="container py-4">
        <Flash />
        <Routes>
          {/* Экран 1: главная — список фильмов */}
          <Route path="/" element={<MovieListPage />} />
          {/* Экран 2: форма добавления / редактирования */}
          <Route path="/movies/new" element={<MovieFormPage />} />
          <Route path="/movies/:id/edit" element={<MovieFormPage />} />
          {/* Экран 3: поиск и фильтрация + детали фильма */}
          <Route path="/search" element={<SearchPage />} />
          <Route path="/movies/:id" element={<MovieDetailsPage />} />
          {/* Дополнительно */}
          <Route path="/genres" element={<GenresPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </>
  )
}

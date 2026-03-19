<?php

/** @var \Laravel\Lumen\Routing\Router $router */

// Simple health check / root route
$router->get('/', function () {
    return response()->json(['status' => true, 'message' => 'KomikNesia PHP API OK']);
});

$router->group(['prefix' => 'api'], function () use ($router) {
    // Contents (home/listing)
    // $router->get('contents/genres', 'ContentsController@genres');
    // $router->get('contents', 'ContentsController@index');
    $router->get('contents', 'WestmangaProxyController@contents');

    // Categories
    $router->get('categories', 'CategoriesController@index');
    $router->post('categories', ['middleware' => 'auth', 'uses' => 'CategoriesController@store']);
    $router->put('categories/{id}', ['middleware' => 'auth', 'uses' => 'CategoriesController@update']);
    $router->delete('categories/{id}', ['middleware' => 'auth', 'uses' => 'CategoriesController@destroy']);

    // Featured items
    // $router->get('featured-items', 'FeaturedItemsController@index');
    $router->get('featured-items', 'FeaturedWestmangaController@index');
    $router->post('featured-items/clear-cache', ['middleware' => 'auth', 'uses' => 'FeaturedItemsController@clearCache']);
    $router->post('featured-items', ['middleware' => 'auth', 'uses' => 'FeaturedItemsController@store']);
    $router->put('featured-items/{id}', ['middleware' => 'auth', 'uses' => 'FeaturedItemsController@update']);
    $router->delete('featured-items/{id}', ['middleware' => 'auth', 'uses' => 'FeaturedItemsController@destroy']);

    // Ads
    $router->get('ads', 'AdsController@index');
    $router->post('ads', ['middleware' => 'auth', 'uses' => 'AdsController@store']);
    $router->put('ads/{id}', ['middleware' => 'auth', 'uses' => 'AdsController@update']);
    $router->delete('ads/{id}', ['middleware' => 'auth', 'uses' => 'AdsController@destroy']);

    // Settings
    $router->get('settings', 'SettingsController@show');
    $router->put('settings', ['middleware' => 'auth', 'uses' => 'SettingsController@update']);

    $router->group(['prefix' => 'auth'], function () use ($router) {
        $router->post('register', 'AuthController@register');
        $router->post('login', 'AuthController@login');
        $router->get('me', ['middleware' => 'auth', 'uses' => 'AuthController@me']);
        $router->put('profile', ['middleware' => 'auth', 'uses' => 'AuthController@updateProfile']);
    });

    // Manga-related routes
    $router->group(['prefix' => 'manga'], function () use ($router) {
        $router->get('/', 'MangaController@index');
        $router->get('search', 'MangaController@search');
        $router->get('slug/{slug}', 'MangaController@showBySlug');
        $router->post('import-softkomik', ['middleware' => 'auth', 'uses' => 'MangaImportController@importSoftkomik']);
        $router->post('/', ['middleware' => 'auth', 'uses' => 'MangaController@store']);
        $router->put('{id}', ['middleware' => 'auth', 'uses' => 'MangaController@update']);
        $router->delete('{id}', ['middleware' => 'auth', 'uses' => 'MangaController@destroy']);
        $router->post('{id}/genres', ['middleware' => 'auth', 'uses' => 'MangaController@syncGenres']);
        $router->get('{mangaId}/chapters', 'ChapterController@index');
        $router->post('{mangaId}/chapters', ['middleware' => 'auth', 'uses' => 'ChapterController@store']);
    });

    // Chapter detail and images
    // $router->get('chapters/slug/{slug}', 'ChapterController@showBySlug');
    $router->get('chapters/slug/{slug}', 'WestmangaProxyController@chapterBySlug');
    $router->get('chapters/{chapterId}/images', 'ChapterController@images');
    $router->put('chapters/{id}', ['middleware' => 'auth', 'uses' => 'ChapterController@update']);
    $router->delete('chapters/{id}', ['middleware' => 'auth', 'uses' => 'ChapterController@destroy']);
    $router->post('chapters/{chapterId}/images', ['middleware' => 'auth', 'uses' => 'ChapterController@uploadImages']);
    $router->post('chapters/{chapterId}/images-from-urls', ['middleware' => 'auth', 'uses' => 'ChapterController@imagesFromUrls']);
    $router->put('chapters/{chapterId}/images/reorder', ['middleware' => 'auth', 'uses' => 'ChapterController@reorderImages']);
    $router->delete('chapters/{chapterId}/images/{imageId}', ['middleware' => 'auth', 'uses' => 'ChapterController@deleteImage']);

    // Image proxy
    $router->get('image-proxy', 'ImageProxyController@proxy');

    // Comic detail (Westmanga)
    // $router->get('comic/{slug}', 'MangaController@showComic');
    $router->get('comic/{slug}', 'WestmangaProxyController@comic');
    $router->post('comic/{slug}/view', 'MangaController@incrementView');

    // Comments (manga or chapter; replies via parent_id)
    $router->get('comments', 'CommentsController@index');
    $router->post('comments', ['middleware' => 'auth', 'uses' => 'CommentsController@store']);
    $router->delete('comments/{id}', ['middleware' => 'auth', 'uses' => 'CommentsController@destroy']);

    // Votes (by manga slug)
    $router->get('votes/{slug}', 'VotesController@show');
    $router->post('votes', 'VotesController@store');

    // Bookmarks (requires auth)
    $router->get('bookmarks', ['middleware' => 'auth', 'uses' => 'BookmarksController@index']);
    $router->post('bookmarks', ['middleware' => 'auth', 'uses' => 'BookmarksController@store']);
    $router->delete('bookmarks/{mangaId}', ['middleware' => 'auth', 'uses' => 'BookmarksController@destroy']);
    $router->get('bookmarks/check/{mangaId}', ['middleware' => 'auth', 'uses' => 'BookmarksController@check']);

    // Dashboard stats (admin)
    $router->get('dashboard/stats', ['middleware' => 'auth', 'uses' => 'DashboardController@stats']);

    // Contact info
    $router->get('contact-info', 'ContactInfoController@index');
    $router->post('contact-info', ['middleware' => 'auth', 'uses' => 'ContactInfoController@store']);
    $router->put('contact-info/{id}', ['middleware' => 'auth', 'uses' => 'ContactInfoController@update']);
    $router->delete('contact-info/{id}', ['middleware' => 'auth', 'uses' => 'ContactInfoController@destroy']);
});


<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function stats()
    {
        try {
            $mangaCount = DB::table('manga')->count();
            $categoryCount = DB::table('categories')->count();
            $totalViews = (int) (DB::table('manga')->sum('views') ?? 0);
            $adsCount = DB::table('ads')->count();

            return response()->json([
                'totalManga' => $mangaCount,
                'totalCategories' => $categoryCount,
                'totalViews' => $totalViews,
                'totalAds' => $adsCount,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Internal server error',
            ], 500);
        }
    }
}


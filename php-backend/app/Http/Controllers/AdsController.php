<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdsController extends Controller
{
    protected function uploadsDir(): string
    {
        $dir = base_path('public/uploads-komiknesia');
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        return $dir;
    }

    protected function storeUploadedImage(?\Illuminate\Http\UploadedFile $file): ?string
    {
        if (!$file) {
            return null;
        }

        $extension = $file->getClientOriginalExtension() ?: 'jpg';
        $filename = 'ads-' . time() . '-' . bin2hex(random_bytes(4)) . '.' . $extension;

        $file->move($this->uploadsDir(), $filename);

        return '/uploads-komiknesia/' . $filename;
    }

    public function index()
    {
        try {
            $ads = DB::table('ads')
                ->orderByDesc('created_at')
                ->limit(20)
                ->get();

            return response()->json($ads);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    public function store(Request $request)
    {
        try {
            $imagePath = $this->storeUploadedImage($request->file('image'));

            $id = DB::table('ads')->insertGetId([
                'image' => $imagePath,
                'link_url' => $request->input('link_url'),
                'ads_type' => $request->input('ads_type'),
                'image_alt' => $request->input('image_alt'),
                'title' => $request->input('title'),
            ]);

            return response()->json([
                'id' => $id,
                'message' => 'Ad created successfully',
            ], 201);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    public function update($id, Request $request)
    {
        try {
            $ad = DB::table('ads')->where('id', $id)->first();
            if (!$ad) {
                return response()->json(['error' => 'Ad not found'], 404);
            }

            // Workaround for PUT form-data not being parsed in some environments
            $payload = $request->all();
            if (empty($payload) && $request->getContent()) {
                parse_str($request->getContent(), $payload);
            }

            $data = [
                'link_url' => $payload['link_url'] ?? $ad->link_url,
                'ads_type' => $payload['ads_type'] ?? $ad->ads_type,
                'image_alt' => $payload['image_alt'] ?? $ad->image_alt,
                'title' => $payload['title'] ?? $ad->title,
            ];

            $imageFile = $request->file('image');
            if ($imageFile) {
                $data['image'] = $this->storeUploadedImage($imageFile);
            }

            DB::table('ads')
                ->where('id', $id)
                ->update($data);

            $updatedAd = DB::table('ads')->where('id', $id)->first();

            return response()->json([
                'message' => 'Ad updated successfully',
                'ad' => $updatedAd,
            ]);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    public function destroy($id)
    {
        try {
            DB::table('ads')
                ->where('id', $id)
                ->delete();

            return response()->json(['message' => 'Ad deleted successfully']);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }
}


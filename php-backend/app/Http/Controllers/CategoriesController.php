<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CategoriesController extends Controller
{
    public function index()
    {
        try {
            $rows = DB::table('categories as c')
                ->leftJoin('manga as m', 'c.id', '=', 'm.category_id')
                ->select('c.*', DB::raw('COUNT(m.id) as manga_count'))
                ->groupBy('c.id')
                ->orderBy('c.name')
                ->get();

            return response()->json($rows);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    public function store(Request $request)
    {
        try {
            $name = $request->input('name');
            $description = $request->input('description');

            if (!$name) {
                return response()->json(['error' => 'Name is required'], 400);
            }

            $id = DB::table('categories')->insertGetId([
                'name' => $name,
                'description' => $description,
            ]);

            return response()->json([
                'id' => $id,
                'message' => 'Category created successfully',
            ], 201);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    public function update($id, Request $request)
    {
        try {
            $name = $request->input('name');
            $description = $request->input('description');

            DB::table('categories')
                ->where('id', $id)
                ->update([
                    'name' => $name,
                    'description' => $description,
                ]);

            return response()->json(['message' => 'Category updated successfully']);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    public function destroy($id)
    {
        try {
            DB::table('categories')
                ->where('id', $id)
                ->delete();

            return response()->json(['message' => 'Category deleted successfully']);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }
}


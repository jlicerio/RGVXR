bl_info = {
    "name": "AR Project Developer",
    "author": "AR Project Team",
    "version": (0, 1),
    "blender": (3, 0, 0),
    "location": "View3D > Sidebar > AR Project",
    "description": "Develop AR projects directly from Blender",
    "category": "3D View",
}

import bpy
import requests
import json
import os
import tempfile
from bpy.props import StringProperty, IntProperty, CollectionProperty, PointerProperty, BoolProperty, EnumProperty, FloatProperty
from bpy.types import PropertyGroup, Panel, Operator, UIList
from mathutils import Vector
import math

# Data structures
class ARProject(PropertyGroup):
    id: StringProperty(name="ID")
    name: StringProperty(name="Name")
    title: StringProperty(name="Title")
    path: StringProperty(name="Path")

# Store server connection status in a PropertyGroup
class ARServerSettings(PropertyGroup):
    url: StringProperty(
        name="Server URL",
        description="URL of the AR development server",
        default="https://localhost:8080"
    )
    connected: BoolProperty(
        name="Connected",
        description="Whether the server is connected",
        default=False
    )

# Server communication as a module-level function instead of a class
def connect_to_server(context):
    server_url = context.scene.ar_server_settings.url
    try:
        response = requests.get(f"{server_url}/api/test", verify=False)
        if response.status_code == 200:
            context.scene.ar_server_settings.connected = True
            return True, "Connected successfully"
        return False, f"Server error: {response.status_code}"
    except Exception as e:
        return False, f"Connection error: {str(e)}"

def get_projects(context):
    if not context.scene.ar_server_settings.connected:
        return []
    
    server_url = context.scene.ar_server_settings.url
    try:
        response = requests.get(f"{server_url}/api/projects", verify=False)
        if response.status_code == 200:
            return response.json()
        return []
    except Exception as e:
        print(f"Error fetching projects: {str(e)}")
        return []

# Operators
class AR_OT_ConnectServer(Operator):
    bl_idname = "ar.connect_server"
    bl_label = "Connect to AR Server"
    bl_description = "Connect to the AR development server"
    
    def execute(self, context):
        if not context.scene.ar_server_settings.url:
            self.report({'ERROR'}, "Please enter a server URL")
            return {'CANCELLED'}
        
        success, message = connect_to_server(context)
        
        if success:
            # Fetch projects
            projects = get_projects(context)
            
            # Clear existing projects
            context.scene.ar_projects.clear()
            
            # Add projects to the list
            for project in projects:
                item = context.scene.ar_projects.add()
                item.id = project.get('id', '')
                item.name = project.get('name', '')
                item.title = project.get('title', '')
                item.path = project.get('path', '')
            
            self.report({'INFO'}, f"Connected to server. Found {len(projects)} projects.")
            return {'FINISHED'}
        else:
            self.report({'ERROR'}, message)
            return {'CANCELLED'}

class AR_OT_ExportToAR(Operator):
    bl_idname = "ar.export_to_ar"
    bl_label = "Export to AR Project"
    bl_description = "Export selected objects to the AR project"
    
    def execute(self, context):
        # Check if a project is selected
        project_index = context.scene.ar_project_index
        if project_index >= len(context.scene.ar_projects):
            self.report({'ERROR'}, "No project selected")
            return {'CANCELLED'}
        
        # Get the selected project
        project = context.scene.ar_projects[project_index]
        
        # Check if there are selected objects
        if not context.selected_objects:
            self.report({'ERROR'}, "No objects selected")
            return {'CANCELLED'}
        
        # Export selected objects to glTF
        temp_dir = tempfile.gettempdir()
        export_path = os.path.join(temp_dir, "ar_export.glb")
        
        try:
            bpy.ops.export_scene.gltf(
                filepath=export_path,
                export_format='GLB',
                use_selection=True
            )
        except Exception as e:
            self.report({'ERROR'}, f"Export failed: {str(e)}")
            return {'CANCELLED'}
        
        # Upload to server
        try:
            server_url = context.scene.ar_server_settings.url
            with open(export_path, 'rb') as f:
                files = {'model': f}
                data = {'project_id': project.id}
                response = requests.post(
                    f"{server_url}/api/blender/api/upload_model",
                    files=files,
                    data=data,
                    verify=False
                )
            
            if response.status_code == 200:
                self.report({'INFO'}, "Model uploaded successfully")
                return {'FINISHED'}
            else:
                self.report({'ERROR'}, f"Upload failed: {response.status_code}")
                return {'CANCELLED'}
        except Exception as e:
            self.report({'ERROR'}, f"Upload error: {str(e)}")
            return {'CANCELLED'}

class AR_OT_PreviewInAR(Operator):
    bl_idname = "ar.preview_in_ar"
    bl_label = "Preview in AR"
    bl_description = "Preview the current scene in AR"
    
    def execute(self, context):
        # Check if a project is selected
        project_index = context.scene.ar_project_index
        if project_index >= len(context.scene.ar_projects):
            self.report({'ERROR'}, "No project selected")
            return {'CANCELLED'}
        
        # Get the selected project
        project = context.scene.ar_projects[project_index]
        
        # Open the project URL
        import webbrowser
        project_url = f"{context.scene.ar_server_settings.url}{project.path}"
        webbrowser.open(project_url)
        
        self.report({'INFO'}, f"Opening preview for {project.title}")
        return {'FINISHED'}

class AR_OT_CreateProject(Operator):
    bl_idname = "ar.create_project"
    bl_label = "Create New Project"
    bl_description = "Create a new AR project"
    
    project_name: StringProperty(
        name="Project Name",
        description="Name of the new AR project",
        default="New AR Project"
    )
    
    project_type: EnumProperty(
        name="Project Type",
        description="Type of AR project to create",
        items=[
            ('basic', "Basic AR", "Simple AR project with a marker"),
            ('model', "3D Model", "AR project with a 3D model"),
            ('primitive', "Primitives", "AR project with basic shapes")
        ],
        default='model'
    )
    
    def invoke(self, context, event):
        return context.window_manager.invoke_props_dialog(self)
    
    def draw(self, context):
        layout = self.layout
        layout.prop(self, "project_name")
        layout.prop(self, "project_type")
    
    def execute(self, context):
        if not context.scene.ar_server_settings.connected:
            self.report({'ERROR'}, "Not connected to server")
            return {'CANCELLED'}
        
        server_url = context.scene.ar_server_settings.url
        
        # Create project on server
        try:
            response = requests.post(
                f"{server_url}/api/blender/create_project",
                json={
                    'name': self.project_name,
                    'type': self.project_type
                },
                verify=False
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Add the new project to the list
                item = context.scene.ar_projects.add()
                item.id = data.get('id', '')
                item.name = data.get('name', '')
                item.title = data.get('title', '')
                item.path = data.get('path', '')
                
                # Select the new project
                context.scene.ar_project_index = len(context.scene.ar_projects) - 1
                
                self.report({'INFO'}, f"Project '{self.project_name}' created successfully")
                return {'FINISHED'}
            else:
                self.report({'ERROR'}, f"Failed to create project: {response.status_code}")
                return {'CANCELLED'}
        except Exception as e:
            self.report({'ERROR'}, f"Error creating project: {str(e)}")
            return {'CANCELLED'}

class AR_OT_FixPermissions(Operator):
    bl_idname = "ar.fix_permissions"
    bl_label = "Fix Project Permissions"
    bl_description = "Fix read/write permissions for project files"
    
    def execute(self, context):
        if not context.scene.ar_server_settings.connected:
            self.report({'ERROR'}, "Not connected to server")
            return {'CANCELLED'}
        
        server_url = context.scene.ar_server_settings.url
        
        try:
            response = requests.post(
                f"{server_url}/api/blender/fix_permissions",
                verify=False
            )
            
            if response.status_code == 200:
                self.report({'INFO'}, "Project permissions fixed successfully")
                return {'FINISHED'}
            else:
                self.report({'ERROR'}, f"Failed to fix permissions: {response.status_code}")
                return {'CANCELLED'}
        except Exception as e:
            self.report({'ERROR'}, f"Error fixing permissions: {str(e)}")
            return {'CANCELLED'}

# Add a new operator for setting GPS locations
class AR_OT_SetGPSLocation(Operator):
    bl_idname = "ar.set_gps_location"
    bl_label = "Set GPS Location"
    bl_description = "Set GPS coordinates for AR content"
    
    latitude: StringProperty(
        name="Latitude",
        description="GPS latitude (e.g., 26.1943)"
    )
    
    longitude: StringProperty(
        name="Longitude",
        description="GPS longitude (e.g., -98.1581)"
    )
    
    radius: FloatProperty(
        name="Trigger Radius (meters)",
        description="Distance in meters that will trigger the AR content",
        default=25.0,
        min=1.0,
        max=1000.0
    )
    
    notification_text: StringProperty(
        name="Notification Text",
        description="Text to display when user enters the area",
        default="AR content available nearby!"
    )
    
    def invoke(self, context, event):
        # Try to load existing GPS data if available
        project_index = context.scene.ar_project_index
        if project_index >= len(context.scene.ar_projects):
            return context.window_manager.invoke_props_dialog(self)
        
        project = context.scene.ar_projects[project_index]
        server_url = context.scene.ar_server_settings.url
        
        try:
            response = requests.get(
                f"{server_url}/api/blender/project/{project.id}/gps",
                verify=False
            )
            
            if response.status_code == 200:
                data = response.json()
                self.latitude = str(data.get('latitude', ''))
                self.longitude = str(data.get('longitude', ''))
                self.radius = float(data.get('radius', 25.0))
                self.notification_text = data.get('notification', 'AR content available nearby!')
        except:
            pass
            
        return context.window_manager.invoke_props_dialog(self)
    
    def draw(self, context):
        layout = self.layout
        layout.prop(self, "latitude")
        layout.prop(self, "longitude")
        layout.prop(self, "radius")
        layout.prop(self, "notification_text")
        
        # Add a helpful note
        box = layout.box()
        box.label(text="Tip: Find coordinates on Google Maps")
        box.label(text="Right-click on map → 'What's here?'")
    
    def execute(self, context):
        # Validate inputs
        try:
            lat = float(self.latitude)
            lon = float(self.longitude)
            
            if lat < -90 or lat > 90:
                self.report({'ERROR'}, "Latitude must be between -90 and 90")
                return {'CANCELLED'}
                
            if lon < -180 or lon > 180:
                self.report({'ERROR'}, "Longitude must be between -180 and 180")
                return {'CANCELLED'}
        except ValueError:
            self.report({'ERROR'}, "Latitude and longitude must be valid numbers")
            return {'CANCELLED'}
        
        # Get the current project
        project_index = context.scene.ar_project_index
        if project_index >= len(context.scene.ar_projects):
            self.report({'ERROR'}, "No project selected")
            return {'CANCELLED'}
        
        project = context.scene.ar_projects[project_index]
        server_url = context.scene.ar_server_settings.url
        
        # Save GPS data to server
        try:
            response = requests.post(
                f"{server_url}/api/blender/project/{project.id}/gps",
                json={
                    'latitude': float(self.latitude),
                    'longitude': float(self.longitude),
                    'radius': self.radius,
                    'notification': self.notification_text
                },
                verify=False
            )
            
            if response.status_code == 200:
                self.report({'INFO'}, f"GPS location set for {project.title}")
                return {'FINISHED'}
            else:
                self.report({'ERROR'}, f"Failed to set GPS location: {response.status_code}")
                return {'CANCELLED'}
        except Exception as e:
            self.report({'ERROR'}, f"Error setting GPS location: {str(e)}")
            return {'CANCELLED'}

# Add a visualization helper for GPS locations
class AR_OT_VisualizeGPS(Operator):
    bl_idname = "ar.visualize_gps"
    bl_label = "Visualize GPS Area"
    bl_description = "Create a visual representation of the GPS trigger area"
    
    def execute(self, context):
        # Get the current project
        project_index = context.scene.ar_project_index
        if project_index >= len(context.scene.ar_projects):
            self.report({'ERROR'}, "No project selected")
            return {'CANCELLED'}
        
        project = context.scene.ar_projects[project_index]
        server_url = context.scene.ar_server_settings.url
        
        # Get GPS data from server
        try:
            response = requests.get(
                f"{server_url}/api/blender/project/{project.id}/gps",
                verify=False
            )
            
            if response.status_code != 200:
                self.report({'ERROR'}, "No GPS data available for this project")
                return {'CANCELLED'}
                
            data = response.json()
            
            # Create a circle to represent the GPS area
            bpy.ops.mesh.primitive_circle_add(
                vertices=32,
                radius=data.get('radius', 25.0),
                location=(0, 0, 0)
            )
            
            # Name the object
            circle = context.active_object
            circle.name = f"GPS_Area_{project.id}"
            
            # Add a material
            if "GPS_Area_Material" not in bpy.data.materials:
                mat = bpy.data.materials.new("GPS_Area_Material")
                mat.diffuse_color = (0.2, 0.6, 1.0, 0.3)  # Blue, semi-transparent
                mat.use_nodes = True
                
                # Make it transparent
                if hasattr(mat, 'blend_method'):
                    mat.blend_method = 'BLEND'
                
                # Set up nodes for transparency
                nodes = mat.node_tree.nodes
                links = mat.node_tree.links
                
                # Clear default nodes
                for node in nodes:
                    nodes.remove(node)
                
                # Create nodes
                output = nodes.new(type='ShaderNodeOutputMaterial')
                bsdf = nodes.new(type='ShaderNodeBsdfTransparent')
                
                # Connect nodes
                links.new(bsdf.outputs[0], output.inputs[0])
            
            # Assign material
            circle.data.materials.append(bpy.data.materials["GPS_Area_Material"])
            
            # Add text for coordinates
            bpy.ops.object.text_add(location=(0, 0, 0.1))
            text = context.active_object
            text.name = f"GPS_Coords_{project.id}"
            text.data.body = f"Lat: {data.get('latitude')}\nLon: {data.get('longitude')}\nRadius: {data.get('radius')}m"
            text.data.align_x = 'CENTER'
            text.data.size = 1.0
            
            self.report({'INFO'}, "GPS area visualized")
            return {'FINISHED'}
        except Exception as e:
            self.report({'ERROR'}, f"Error visualizing GPS area: {str(e)}")
            return {'CANCELLED'}

# UI Classes
class AR_UL_ProjectList(UIList):
    def draw_item(self, context, layout, data, item, icon, active_data, active_propname):
        if self.layout_type in {'DEFAULT', 'COMPACT'}:
            layout.label(text=item.title)
        elif self.layout_type in {'GRID'}:
            layout.alignment = 'CENTER'
            layout.label(text=item.title)

class AR_PT_ProjectPanel(Panel):
    bl_label = "AR Project Developer"
    bl_idname = "AR_PT_project_panel"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'AR Project'
    
    def draw(self, context):
        layout = self.layout
        scene = context.scene
        
        # Server connection
        box = layout.box()
        box.label(text="Server Connection")
        box.prop(scene.ar_server_settings, "url", text="Server URL")
        
        row = box.row()
        row.operator("ar.connect_server")
        
        if scene.ar_server_settings.connected:
            row.label(text="✓ Connected", icon='CHECKMARK')
        
        # Add fix permissions button
        box.operator("ar.fix_permissions", icon='FILE_REFRESH')
        
        # Project selection
        box = layout.box()
        box.label(text="AR Projects")
        
        row = box.row()
        row.template_list("AR_UL_ProjectList", "", scene, "ar_projects", scene, "ar_project_index")
        
        col = row.column(align=True)
        col.operator("ar.create_project", icon='ADD', text="")
        
        # Export and preview
        if len(scene.ar_projects) > 0 and scene.ar_project_index >= 0:
            project = scene.ar_projects[scene.ar_project_index]
            box = layout.box()
            box.label(text=f"Selected: {project.title}")
            
            row = box.row()
            row.operator("ar.export_to_ar")
            row.operator("ar.preview_in_ar")
            
            # Add GPS controls for AR GPS projects
            if "gps" in project.id.lower():
                gps_box = layout.box()
                gps_box.label(text="GPS Location Settings", icon='WORLD')
                
                row = gps_box.row()
                row.operator("ar.set_gps_location")
                row.operator("ar.visualize_gps")

# Registration
classes = (
    ARProject,
    ARServerSettings,
    AR_OT_ConnectServer,
    AR_OT_ExportToAR,
    AR_OT_PreviewInAR,
    AR_OT_CreateProject,
    AR_OT_FixPermissions,
    AR_OT_SetGPSLocation,
    AR_OT_VisualizeGPS,
    AR_UL_ProjectList,
    AR_PT_ProjectPanel,
)

def register():
    for cls in classes:
        bpy.utils.register_class(cls)
    
    # Register properties
    bpy.types.Scene.ar_server_settings = PointerProperty(type=ARServerSettings)
    bpy.types.Scene.ar_projects = CollectionProperty(type=ARProject)
    bpy.types.Scene.ar_project_index = IntProperty(default=0)

def unregister():
    # Unregister properties
    del bpy.types.Scene.ar_project_index
    del bpy.types.Scene.ar_projects
    del bpy.types.Scene.ar_server_settings
    
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)

if __name__ == "__main__":
    register() 